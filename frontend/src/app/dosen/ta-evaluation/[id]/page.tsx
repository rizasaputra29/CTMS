'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, User, BookOpen, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AssessmentComponent {
    id: number;
    name: string;
    code: string;
    description: string;
    weight: number;
}

interface Student {
    id: number;
    name: string;
    nim: string;
}

interface TaDefenseSchedule {
    id: number;
    student: Student;
    group: { id: number; name: string; code: string };
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: string;
    evaluation_deadline: string;
}

interface EvaluationContext {
    schedule: TaDefenseSchedule;
    components: AssessmentComponent[];
    existing_scores: Record<string, { score: string; notes?: string }>;
}

interface ExistingScoreValue {
    score?: string | number;
    notes?: string;
}

export default function TaEvaluationPage() {
    const { id } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [context, setContext] = useState<EvaluationContext | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const response = await api.get(`/dosen/evaluation-context/TA_DEFENSE/${id}`);
                const data = response.data.data;
                setContext(data);

                // Initialize scores from existing data
                const initialScores: Record<string, number> = {};
                const initialNotes: Record<string, string> = {};
                
                if (data.existing_scores) {
                    Object.entries(data.existing_scores as Record<string, ExistingScoreValue>).forEach(([key, value]) => {
                        initialScores[key] = parseFloat(String(value.score)) || 0;
                        if (value.notes) initialNotes[key] = value.notes;
                    });
                }
                
                setScores(initialScores);
                setNotes(initialNotes);
            } catch {
                toast.error('Failed to load evaluation context');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchContext();
        }
    }, [id]);

    const handleScoreChange = (componentId: number, value: string) => {
        const numValue = Math.min(100, Math.max(0, parseFloat(value) || 0));
        setScores(prev => ({
            ...prev,
            [`${componentId}`]: numValue
        }));
    };

    const handleNotesChange = (componentId: number, value: string) => {
        setNotes(prev => ({
            ...prev,
            [`${componentId}`]: value
        }));
    };

    const handleSubmit = async () => {
        if (!context) return;

        // Validate all components have scores
        const unscoredComponents = context.components.filter(c => scores[c.id] === undefined);
        if (unscoredComponents.length > 0) {
            toast.error(`Please provide scores for all components (${unscoredComponents.length} remaining)`);
            return;
        }

        try {
            setSubmitting(true);

            const scorePayload = {
                student_id: context.schedule.student.id,
                group_id: context.schedule.group.id,
                evaluation_type: 'TA_DEFENSE',
                scores: Object.entries(scores).map(([componentId, score]) => ({
                    period_component_id: parseInt(componentId),
                    student_id: context.schedule.student.id,
                    score: score,
                    notes: notes[componentId] || ''
                }))
            };

            await api.post('/dosen/assessment-scores', scorePayload);

            // Finalize the evaluation
            await api.post(`/dosen/ta-defense/${id}/evaluate`, {
                result: 'PASS',
                notes: 'Evaluation completed'
            });

            toast.success('Evaluation submitted successfully');
            router.push('/dosen/evaluation');
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to submit evaluation'
                : 'Failed to submit evaluation';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto py-6 max-w-4xl">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (!context) {
        return (
            <div className="container mx-auto py-6 max-w-4xl">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Failed to load evaluation context</AlertDescription>
                </Alert>
            </div>
        );
    }

    const { schedule, components } = context;
    const isDeadlinePassed = new Date(schedule.evaluation_deadline) < new Date();
    const allScored = components.every(c => scores[c.id] !== undefined);

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            {/* Header */}
            <div className="mb-6">
                <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">TA Defense Evaluation</h1>
                        <p className="text-muted-foreground mt-1">
                            Evaluate student TA defense presentation
                        </p>
                    </div>
                    {schedule.status === 'DONE' && (
                        <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Completed
                        </Badge>
                    )}
                </div>
            </div>

            {/* Schedule Info */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-lg">Schedule Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center text-sm">
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{schedule.student.name}</span>
                        <span className="text-muted-foreground ml-2">({schedule.student.nim})</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Group {schedule.group.id}</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{schedule.start_time} - {schedule.end_time}</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{schedule.room || 'Room not set'}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Deadline Alert */}
            {isDeadlinePassed && schedule.status !== 'DONE' && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Evaluation deadline has passed ({new Date(schedule.evaluation_deadline).toLocaleDateString('id-ID')}).
                        Please submit as soon as possible.
                    </AlertDescription>
                </Alert>
            )}

            {/* Evaluation Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Assessment Components</CardTitle>
                    <CardDescription>
                        Rate the student on each component (0-100)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {components.map((component) => (
                        <div key={component.id} className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-medium">{component.name}</h3>
                                    <p className="text-sm text-muted-foreground">{component.code}</p>
                                    {component.description && (
                                        <p className="text-sm text-muted-foreground mt-1">{component.description}</p>
                                    )}
                                </div>
                                <Badge variant="outline">Weight: {component.weight}%</Badge>
                            </div>
                            
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`score-${component.id}`}>Score (0-100)</Label>
                                    <Input
                                        id={`score-${component.id}`}
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={scores[component.id] || ''}
                                        onChange={(e) => handleScoreChange(component.id, e.target.value)}
                                        disabled={schedule.status === 'DONE'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`notes-${component.id}`}>Notes (Optional)</Label>
                                    <Textarea
                                        id={`notes-${component.id}`}
                                        placeholder="Additional feedback..."
                                        value={notes[component.id] || ''}
                                        onChange={(e) => handleNotesChange(component.id, e.target.value)}
                                        disabled={schedule.status === 'DONE'}
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <Separator />
                        </div>
                    ))}

                    {schedule.status !== 'DONE' && (
                        <div className="flex items-center justify-between pt-4">
                            <div className="text-sm text-muted-foreground">
                                {allScored ? (
                                    <span className="text-green-600 flex items-center">
                                        <CheckCircle2 className="mr-1 h-4 w-4" />
                                        All components scored
                                    </span>
                                ) : (
                                    <span className="flex items-center">
                                        <AlertCircle className="mr-1 h-4 w-4" />
                                        {components.filter(c => scores[c.id] === undefined).length} components remaining
                                    </span>
                                )}
                            </div>
                            <Button 
                                onClick={handleSubmit} 
                                disabled={submitting || !allScored}
                                size="lg"
                            >
                                {submitting ? (
                                    <>
                                        <Save className="mr-2 h-4 w-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Submit Evaluation
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
