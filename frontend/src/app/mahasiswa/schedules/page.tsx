'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Calendar, Clock, MapPin, Users, GraduationCap, Plus } from 'lucide-react';
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

interface Examiner { id: number; name: string; }
interface EvalItem { id: number; examiner: Examiner; status: string; score: number | null; }

interface SeminarSchedule {
    id: number; type: string; date: string; start_time: string; end_time: string;
    room: string | null; status: string; rejection_reason?: string;
    examiner1: Examiner; examiner2: Examiner;
    evaluations: EvalItem[];
}

interface TaDefenseSchedule {
    id: number; date: string; start_time: string; end_time: string;
    room: string | null; status: string; rejection_reason?: string;
    student: { name: string };
    examiners: { examiner: Examiner; role: string }[];
    evaluations: EvalItem[];
}

interface Dosen { id: number; name: string; }

export default function StudentSchedulesPage() {
    const [seminars, setSeminars] = useState<SeminarSchedule[]>([]);
    const [taDefense, setTaDefense] = useState<TaDefenseSchedule | null>(null);
    const [dosens, setDosens] = useState<Dosen[]>([]);
    const [loading, setLoading] = useState(true);

    // Request form
    const [requestOpen, setRequestOpen] = useState(false);
    const [requestType, setRequestType] = useState<'SEMPRO' | 'TA_DEFENSE'>('SEMPRO');
    const [formDate, setFormDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('');
    const [formEndTime, setFormEndTime] = useState('');
    const [formRoom, setFormRoom] = useState('');
    const [formExaminer1, setFormExaminer1] = useState('');
    const [formExaminer2, setFormExaminer2] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [schedRes, lecturerRes] = await Promise.all([
                api.get('/mahasiswa/seminar-schedules'),
                api.get('/mahasiswa/lecturers').catch(() => ({ data: { data: [] } })),
            ]);
            // Backend returns { data: { seminars: [...], ta_defense: ... } }
            const schedData = schedRes.data.data || {};
            setSeminars(schedData.seminars || []);
            setTaDefense(schedData.ta_defense || null);
            setDosens(lecturerRes.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setFormDate(''); setFormStartTime(''); setFormEndTime('');
        setFormRoom(''); setFormExaminer1(''); setFormExaminer2('');
    };

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const endpoint = requestType === 'TA_DEFENSE'
                ? '/mahasiswa/schedule-request/ta-defense'
                : '/mahasiswa/schedule-request/sempro';

            await api.post(endpoint, {
                date: formDate,
                start_time: formStartTime,
                end_time: formEndTime,
                room: formRoom || null,
                examiner_1_id: Number(formExaminer1),
                examiner_2_id: Number(formExaminer2),
            });
            toast.success(`${requestType} schedule request submitted!`);
            setRequestOpen(false); resetForm(); fetchData();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Request failed.');
            } else { toast.error('Request failed.'); }
        } finally { setSubmitting(false); }
    };

    const statusColor = (s: string) => {
        if (s === 'COMPLETED') return 'default' as const;
        if (s === 'CANCELLED') return 'destructive' as const;
        if (s === 'PENDING_APPROVAL') return 'secondary' as const;
        return 'secondary' as const;
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const sempro = seminars.filter(s => s.type === 'SEMPRO');

    const ScheduleCard = ({ s }: { s: SeminarSchedule }) => (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium">Seminar Proposal</CardTitle>
                    <Badge variant={statusColor(s.status)}>{s.status === 'PENDING_APPROVAL' ? '⏳ Pending Approval' : s.status}</Badge>
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
                {s.rejection_reason && (
                    <div className="text-destructive text-xs mt-1">Rejection: {s.rejection_reason}</div>
                )}
                {s.evaluations?.length > 0 && (
                    <div className="flex gap-2 mt-1">
                        {s.evaluations.map(ev => (
                            <Badge key={ev.id} variant={ev.status === 'SUBMITTED' ? 'default' : 'outline'}>
                                {ev.examiner?.name}: {ev.status === 'SUBMITTED' ? `${ev.score}` : 'Pending'}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Schedules</h1>
                    <p className="text-muted-foreground">View and request SEMPRO, EXPO, and TA Defense schedules.</p>
                </div>
                <Button onClick={() => setRequestOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Request Schedule
                </Button>
            </div>

            <Tabs defaultValue="sempro">
                <TabsList>
                    <TabsTrigger value="sempro">SEMPRO ({sempro.length})</TabsTrigger>
                    <TabsTrigger value="ta">TA Defense</TabsTrigger>
                </TabsList>

                <TabsContent value="sempro" className="space-y-3">
                    {sempro.length === 0 ? (
                        <div className="text-center py-12 border rounded-lg border-dashed">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                            <p className="text-muted-foreground">No SEMPRO schedule yet.</p>
                            <Button variant="outline" className="mt-3" onClick={() => { setRequestType('SEMPRO'); setRequestOpen(true); }}>Request SEMPRO</Button>
                        </div>
                    ) : sempro.map(s => <ScheduleCard key={s.id} s={s} />)}
                </TabsContent>

                <TabsContent value="ta" className="space-y-3">
                    {!taDefense ? (
                        <div className="text-center py-12 border rounded-lg border-dashed">
                            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                            <p className="text-muted-foreground">No TA Defense schedule yet.</p>
                            <Button variant="outline" className="mt-3" onClick={() => { setRequestType('TA_DEFENSE'); setRequestOpen(true); }}>Request TA Defense</Button>
                        </div>
                    ) : (
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-sm font-medium">Tugas Akhir Defense</CardTitle>
                                    <Badge variant={statusColor(taDefense.status)}>
                                        {taDefense.status === 'PENDING_APPROVAL' ? '⏳ Pending Approval' : taDefense.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-center gap-4 text-muted-foreground">
                                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {taDefense.date}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {taDefense.start_time} - {taDefense.end_time}</span>
                                    {taDefense.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {taDefense.room}</span>}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {taDefense.examiners?.map((ex, i) => (
                                        <Badge key={i} variant="outline">{ex.role}: {ex.examiner?.name}</Badge>
                                    ))}
                                </div>
                                {taDefense.rejection_reason && (
                                    <div className="text-destructive text-xs mt-1">Rejection: {taDefense.rejection_reason}</div>
                                )}
                                {taDefense.evaluations?.length > 0 && (
                                    <div className="flex gap-2 mt-1">
                                        {taDefense.evaluations.map(ev => (
                                            <Badge key={ev.id} variant={ev.status === 'SUBMITTED' ? 'default' : 'outline'}>
                                                {ev.examiner?.name}: {ev.status === 'SUBMITTED' ? `${ev.score}` : 'Pending'}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Request Schedule Dialog */}
            <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleRequest}>
                        <DialogHeader>
                            <DialogTitle>Request Schedule</DialogTitle>
                            <DialogDescription>Submit a schedule request. Admin will review and approve.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Schedule Type</Label>
                                <Select value={requestType} onValueChange={(v) => setRequestType(v as 'SEMPRO' | 'TA_DEFENSE')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SEMPRO">SEMPRO</SelectItem>
                                        <SelectItem value="TA_DEFENSE">TA Defense</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                            <Button type="button" variant="outline" onClick={() => { setRequestOpen(false); resetForm(); }}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
