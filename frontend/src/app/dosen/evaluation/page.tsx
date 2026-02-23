'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, ClipboardCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface EvalItem {
    id: number;
    status: string;
    score: number | null;
    rubric_json: Record<string, unknown> | null;
    examiner: { id: number; name: string };
}

interface SeminarSchedule {
    id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    group: { id: number; title?: { title: string } };
    evaluations: EvalItem[];
}

interface TaDefenseSchedule {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    student: { id: number; name: string };
    group: { id: number; title?: { title: string } };
    evaluations: EvalItem[];
}

export default function DosenEvaluationPage() {
    const [seminars, setSeminars] = useState<SeminarSchedule[]>([]);
    const [taDefenses, setTaDefenses] = useState<TaDefenseSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    const [evalOpen, setEvalOpen] = useState(false);
    const [evalEndpoint, setEvalEndpoint] = useState('');
    const [rubricNotes, setRubricNotes] = useState('');
    const [score, setScore] = useState('');
    const [result, setResult] = useState('PASS');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/dosen/seminar-schedules/examiner');
            setSeminars(res.data.data?.seminars || []);
            setTaDefenses(res.data.data?.ta_defenses || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openEvalForm = (type: 'seminar' | 'ta_defense', scheduleId: number, seminarType?: string) => {
        if (type === 'seminar') {
            setEvalEndpoint(seminarType === 'EXPO' ? `/dosen/expo/${scheduleId}/evaluate` : `/dosen/sempro/${scheduleId}/evaluate`);
        } else {
            setEvalEndpoint(`/dosen/ta-defense/${scheduleId}/evaluate`);
        }
        setRubricNotes(''); setScore(''); setResult('PASS');
        setEvalOpen(true);
    };

    const handleSubmitEval = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post(evalEndpoint, {
                rubric_json: { notes: rubricNotes },
                score: Number(score),
                result,
            });
            toast.success('Evaluation submitted!');
            setEvalOpen(false);
            fetchData();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Submission failed.');
            } else { toast.error('Submission failed.'); }
        } finally { setSubmitting(false); }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const pendingSeminars = seminars.filter(s => s.evaluations?.some(e => e.status === 'PENDING'));
    const completedSeminars = seminars.filter(s => s.evaluations?.every(e => e.status === 'SUBMITTED'));
    const pendingTa = taDefenses.filter(s => s.evaluations?.some(e => e.status === 'PENDING'));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Evaluations</h1>
                <p className="text-muted-foreground">Review and submit rubric evaluations for assigned schedules.</p>
            </div>

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending">Pending ({pendingSeminars.length + pendingTa.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedSeminars.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="space-y-3">
                    {pendingSeminars.length === 0 && pendingTa.length === 0 && (
                        <div className="text-center py-12 border rounded-lg border-dashed">
                            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                            <h2 className="text-xl font-bold mb-2">All Caught Up!</h2>
                            <p className="text-muted-foreground">No pending evaluations.</p>
                        </div>
                    )}
                    {pendingSeminars.map(s => (
                        <Card key={`sem-${s.id}`}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant="outline" className="mb-1">{s.type}</Badge>
                                        <CardTitle className="text-sm font-medium">{s.group?.title?.title || `Group #${s.group?.id}`}</CardTitle>
                                    </div>
                                    <Badge variant="secondary">PENDING</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-center gap-4 text-muted-foreground">
                                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {s.date}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                                    {s.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.room}</span>}
                                </div>
                                <Button size="sm" onClick={() => openEvalForm('seminar', s.id, s.type)}>
                                    <Send className="mr-1 h-3.5 w-3.5" /> Submit Evaluation
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                    {pendingTa.map(s => (
                        <Card key={`ta-${s.id}`}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant="outline" className="mb-1">TA Defense</Badge>
                                        <CardTitle className="text-sm font-medium">{s.student?.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{s.group?.title?.title}</p>
                                    </div>
                                    <Badge variant="secondary">PENDING</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-center gap-4 text-muted-foreground">
                                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {s.date}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.start_time} - {s.end_time}</span>
                                    {s.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.room}</span>}
                                </div>
                                <Button size="sm" onClick={() => openEvalForm('ta_defense', s.id)}>
                                    <Send className="mr-1 h-3.5 w-3.5" /> Submit Evaluation
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
                <TabsContent value="completed" className="space-y-3">
                    {completedSeminars.length === 0 && <p className="text-muted-foreground text-center py-8">No completed evaluations.</p>}
                    {completedSeminars.map(s => (
                        <Card key={s.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-sm font-medium">{s.type}: {s.group?.title?.title || `Group #${s.group?.id}`}</CardTitle>
                                    <Badge variant="default">SUBMITTED</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                Score: {s.evaluations?.[0]?.score ?? '-'}
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>

            <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSubmitEval}>
                        <DialogHeader>
                            <DialogTitle>Submit Evaluation</DialogTitle>
                            <DialogDescription>Fill in the rubric and submit your score.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Rubric Notes</Label>
                                <Textarea value={rubricNotes} onChange={e => setRubricNotes(e.target.value)} placeholder="Evaluation notes..." rows={4} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Score (0-100)</Label>
                                <Input type="number" min={0} max={100} step={0.01} value={score} onChange={e => setScore(e.target.value)} required />
                            </div>
                            <div className="grid gap-2">
                                <Label>Result</Label>
                                <Select value={result} onValueChange={setResult}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PASS">PASS</SelectItem>
                                        <SelectItem value="FAIL">FAIL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEvalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={submitting || !score}>{submitting ? 'Submitting...' : 'Submit'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
