'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Calendar, Clock, MapPin, Users, GraduationCap, CheckCircle2, Clock4, AlertCircle } from 'lucide-react';
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

interface Evaluator {
    id: number;
    name: string;
    status: 'SUBMITTED' | 'PENDING';
    score: number | null;
}

interface ProgressInfo {
    completed: number;
    total: number;
    percentage: number;
}

interface SeminarSchedule {
    id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    supervisors: Evaluator[];
    examiners: Evaluator[];
    progress: ProgressInfo;
    overall_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE';
    final_result: 'PASS' | 'FAIL' | null;
    group: {
        id: number;
        name: string;
    };
}

interface TaDefenseSchedule {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    student: { name: string };
    examiners: { examiner: { id: number; name: string }; role: string }[];
    evaluations: { id: number; examiner: { name: string }; status: string; score: number | null }[];
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

    const evaluatorStatusColor = (status: string) => {
        if (status === 'SUBMITTED') return 'bg-green-100 text-green-800 border-green-300';
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    };

    const overallStatusMessage = (seminar: SeminarSchedule) => {
        switch (seminar.overall_status) {
            case 'COMPLETE':
                return {
                    text: `Complete - ${seminar.final_result}`,
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    color: seminar.final_result === 'PASS' ? 'text-green-600' : 'text-red-600'
                };
            case 'IN_PROGRESS':
                const pendingCount = seminar.progress.total - seminar.progress.completed;
                return {
                    text: `Waiting for ${pendingCount} evaluation${pendingCount > 1 ? 's' : ''}`,
                    icon: <Clock4 className="h-4 w-4" />,
                    color: 'text-amber-600'
                };
            default:
                return {
                    text: 'Waiting for evaluations',
                    icon: <Clock4 className="h-4 w-4" />,
                    color: 'text-gray-500'
                };
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const sempro = seminars.filter(s => s.type === 'SEMPRO');

    const ScheduleCard = ({ s }: { s: SeminarSchedule }) => {
        const statusInfo = overallStatusMessage(s);

        return (
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-sm font-medium">Seminar Proposal</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Group {s.group.id}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant={statusColor(s.status)}>{s.status === 'PENDING_APPROVAL' ? '⏳ Pending Approval' : s.status}</Badge>
                            <div className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                                {statusInfo.icon}
                                {statusInfo.text}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {/* Schedule Info */}
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {s.date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                        {s.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.room}</span>}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Evaluation Progress</span>
                            <span className="font-medium">{s.progress.completed} of {s.progress.total}</span>
                        </div>
                        <Progress value={s.progress.percentage} className="h-2" />
                    </div>

                    {/* Supervisors Section */}
                    {s.supervisors.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supervisor Evaluations</div>
                            <div className="grid gap-2">
                                {s.supervisors.map((supervisor) => (
                                    <div key={supervisor.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="font-medium">{supervisor.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={evaluatorStatusColor(supervisor.status)}>
                                                {supervisor.status === 'SUBMITTED' ? (
                                                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Submitted</>
                                                ) : (
                                                    <><Clock4 className="h-3 w-3 mr-1" /> Pending</>
                                                )}
                                            </Badge>
                                            {supervisor.score !== null && (
                                                <span className="text-sm font-semibold text-green-600">{supervisor.score}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Examiners Section */}
                    {s.examiners.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Examiner Evaluations</div>
                            <div className="grid gap-2">
                                {s.examiners.map((examiner, index) => (
                                    <div key={examiner.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="font-medium">{examiner.name}</span>
                                            <span className="text-xs text-muted-foreground">(Examiner {index + 1})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={evaluatorStatusColor(examiner.status)}>
                                                {examiner.status === 'SUBMITTED' ? (
                                                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Submitted</>
                                                ) : (
                                                    <><Clock4 className="h-3 w-3 mr-1" /> Pending</>
                                                )}
                                            </Badge>
                                            {examiner.score !== null && (
                                                <span className="text-sm font-semibold text-green-600">{examiner.score}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Final Result */}
                    {s.overall_status === 'COMPLETE' && s.final_result && (
                        <div className={`p-3 rounded-lg text-center font-semibold ${
                            s.final_result === 'PASS' 
                                ? 'bg-green-100 text-green-800 border border-green-300' 
                                : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                            <div className="flex items-center justify-center gap-2">
                                {s.final_result === 'PASS' ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5" />
                                )}
                                Final Result: {s.final_result}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

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
