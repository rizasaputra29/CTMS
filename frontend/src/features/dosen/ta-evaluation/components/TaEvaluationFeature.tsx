'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScoringRubric, formatScoringKey } from '@/components/common/ScoringRubric';
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
import { formatDate } from '@/lib/utils';
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
    const student = schedule.student;
    const isDeadlinePassed = schedule.evaluation_deadline
        ? new Date(schedule.evaluation_deadline) < new Date()
        : false;
    const allScored = components.every(
        (c) => scores[formatScoringKey(c.id, student.id)] !== undefined
    );

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
                            {formatDate(schedule.date)}
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
                        Evaluation deadline has passed ({formatDate(schedule.evaluation_deadline)}).
                        Please submit as soon as possible.
                    </AlertDescription>
                </Alert>
            )}

            {/* Evaluation Form */}
            <ScoringRubric
                title="Assessment Components"
                description="Rate the student on each component (0-100)"
                components={components}
                students={[student]}
                scores={scores}
                notes={notes}
                onScoreChange={handleScoreChange}
                onNoteChange={handleNotesChange}
                readOnly={schedule.status === 'DONE'}
            />

            {schedule.status !== 'DONE' && (
                <Card className="mt-6">
                    <CardContent className="flex items-center justify-between py-6">
                        <div className="text-sm text-muted-foreground">
                            {allScored ? (
                                <span className="text-green-600 flex items-center">
                                    <CheckCircle2 className="mr-1 h-4 w-4" />
                                    All components scored
                                </span>
                            ) : (
                                <span className="flex items-center">
                                    <AlertCircle className="mr-1 h-4 w-4" />
                                    {components.filter(
                                        (c) => scores[formatScoringKey(c.id, student.id)] === undefined
                                    ).length} components remaining
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
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
