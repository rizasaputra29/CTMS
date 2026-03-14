'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, GraduationCap, CalendarDays, CheckCircle2, Clock, MapPin, Users } from 'lucide-react';

interface Evaluation {
    id: number;
    type: string;
    schedule: {
        id: number;
        type: string;
        date: string;
        start_time: string;
        end_time: string;
        room: string;
        group: {
            id: number;
            title: { title: string };
            members: { student: { name: string } }[];
        };
    };
    status: string;
    points: number;
    notes: string;
}

interface SeminarData {
    id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    evaluations?: {
        id: number;
        status: string;
        score: number;
        feedback?: string;
    }[];
    group: {
        id: number;
        title: { title: string };
        members: { student: { name: string } }[];
    };
}

export default function DosenExaminerPage() {
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvaluations = async () => {
            try {
                // Fetch schedules where dosen is examiner
                const res = await api.get('/dosen/seminar-schedules/examiner');
                const seminars: SeminarData[] = res.data.data?.seminars || [];
                const taDefenses: SeminarData[] = res.data.data?.ta_defenses || [];

                const mapped: Evaluation[] = [];

                seminars.forEach((s) => {
                    const myEval = s.evaluations?.[0];
                    if (myEval) {
                        mapped.push({
                            id: myEval.id,
                            type: 'SEMINAR',
                            schedule: { ...s, type: s.type },
                            status: myEval.status,
                            points: myEval.score,
                            notes: myEval.feedback || ''
                        });
                    }
                });

                taDefenses.forEach((t) => {
                    const myEval = t.evaluations?.[0];
                    if (myEval) {
                        // For TA Defense, members array might not exist in the same way, but we added it in backend
                        mapped.push({
                            id: myEval.id,
                            type: 'TA_DEFENSE',
                            schedule: { ...t, type: 'TA_DEFENSE' },
                            status: myEval.status,
                            points: myEval.score,
                            notes: myEval.feedback || ''
                        });
                    }
                });

                setEvaluations(mapped);
            } catch (err) {
                console.error('Failed to fetch evaluations', err);
            } finally {
                setLoading(false);
            }
        };
        fetchEvaluations();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const pending = evaluations.filter(e => e.status === 'PENDING');
    const completed = evaluations.filter(e => e.status !== 'PENDING');

    const EvaluationCard = ({ evalItem }: { evalItem: Evaluation }) => (
        <Card>
            <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant={evalItem.schedule.type === 'SEMPRO' ? 'default' : 'secondary'}>
                                {evalItem.schedule.type}
                            </Badge>
                            <Badge variant={evalItem.status === 'PENDING' ? 'outline' : 'default'} className={evalItem.status === 'PENDING' ? 'text-amber-600 border-amber-600' : 'bg-green-600'}>
                                {evalItem.status}
                            </Badge>
                        </div>
                        <CardTitle className="text-base leading-tight mt-2">
                            {evalItem.schedule.group.title?.title || `Group #${evalItem.schedule.group.id}`}
                        </CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(evalItem.schedule.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{evalItem.schedule.start_time.slice(0, 5)} - {evalItem.schedule.end_time.slice(0, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{evalItem.schedule.room}</span>
                    </div>
                    <div className="flex items-start gap-2 col-span-2">
                        <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>{evalItem.schedule.group.members.map(m => m.student.name).join(', ')}</span>
                    </div>
                </div>

                {evalItem.status === 'PENDING' ? (
                    <Button className="w-full" asChild>
                        <a href={`/dosen/evaluation/${evalItem.id}?type=${evalItem.type}`}>Evaluate Presentation</a>
                    </Button>
                ) : (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm border">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-muted-foreground">Score Given</span>
                            <span className="font-bold text-lg">{evalItem.points}/100</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-xs italic">
                            &quot;{evalItem.notes}&quot;
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Examiner Dashboard</h1>
                <p className="text-muted-foreground">Manage your seminar and defense evaluations.</p>
            </div>

            <Tabs defaultValue="pending" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="pending" className="relative">
                        Pending
                        {pending.length > 0 && (
                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                {pending.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4">
                    {pending.length === 0 ? (
                        <div className="text-center py-12 border rounded-lg border-dashed">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                            <h2 className="text-xl font-bold mb-2">All Caught Up!</h2>
                            <p className="text-muted-foreground">You have no pending evaluations at the moment.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {pending.map(e => <EvaluationCard key={e.id} evalItem={e} />)}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4">
                    {completed.length === 0 ? (
                        <div className="text-center py-12 border rounded-lg border-dashed">
                            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                            <h2 className="text-xl font-bold mb-2">No History</h2>
                            <p className="text-muted-foreground">You haven&#39;t submitted any evaluations yet.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {completed.map(e => <EvaluationCard key={e.id} evalItem={e} />)}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
