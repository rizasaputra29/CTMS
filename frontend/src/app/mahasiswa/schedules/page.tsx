'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, Users, GraduationCap } from 'lucide-react';
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

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


export default function StudentSchedulesPage() {
    const [seminars, setSeminars] = useState<SeminarSchedule[]>([]);
    const [taDefense, setTaDefense] = useState<TaDefenseSchedule | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const schedRes = await api.get('/mahasiswa/seminar-schedules');
            const schedData = schedRes.data.data || {};
            setSeminars(schedData.seminars || []);
            setTaDefense(schedData.ta_defense || null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);


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
                    <p className="text-muted-foreground">View your SEMPRO and TA Defense schedules. Schedules are set by the admin.</p>
                </div>
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
                            <p className="text-muted-foreground">No SEMPRO schedule yet. The admin will set your schedule when your group is ready.</p>
                        </div>
                    ) : sempro.map(s => <ScheduleCard key={s.id} s={s} />)}
                </TabsContent>

                <TabsContent value="ta" className="space-y-3">
                    {!taDefense ? (
                        <div className="text-center py-12 border rounded-lg border-dashed">
                            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                            <p className="text-muted-foreground">No TA Defense schedule yet. The admin will set your schedule when you are ready.</p>
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
        </div>
    );
}
