'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    ArrowLeft,
    Save,
    AlertCircle,
    CheckCircle2,
    User,
    BookOpen,
    Calendar as CalendarIcon,
    Clock,
    MapPin,
} from 'lucide-react';
import { useTaEvaluation } from '../hooks/use-ta-evaluation';

interface TaEvaluationFeatureProps {
    scheduleId: string;
}

export function TaEvaluationFeature({ scheduleId }: TaEvaluationFeatureProps) {
    const router = useRouter();
    const {
        loading,
        submitting,
        context,
        scores,
        notes,
        handleScoreChange,
        handleNotesChange,
        submitEvaluation,
    } = useTaEvaluation(scheduleId);

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
    const allScored = components.every((c) => scores[c.id] !== undefined);

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
                        <p className="text-muted-foreground mt-1">Evaluate student TA defense presentation</p>
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
                        <span>{schedule.group.code || `Group ${schedule.group.id}`}</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>
                            {new Date(schedule.date).toLocaleDateString('id-ID', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </span>
                    </div>
                    <div className="flex items-center text-sm">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>
                            {schedule.start_time} - {schedule.end_time}
                        </span>
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
                    <CardDescription>Rate the student on each component (0-100)</CardDescription>
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
                                        {components.filter((c) => scores[c.id] === undefined).length} components remaining
                                    </span>
                                )}
                            </div>
                            <Button
                                onClick={async () => {
                                    const success = await submitEvaluation();
                                    if (success) router.push('/dosen/evaluation');
                                }}
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
