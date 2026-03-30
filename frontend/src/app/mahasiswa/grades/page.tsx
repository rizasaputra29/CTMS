'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, GraduationCap } from 'lucide-react';

interface Evaluation {
    id: number;
    type: string;
    score: number;
    feedback: string | null;
    evaluator: {
        name: string;
    };
}

export default function MahasiswaGradesPage() {
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGrades = async () => {
            try {
                const response = await api.get('/evaluations');
                setEvaluations(response.data.data);
            } catch (error) {
                console.error('Failed to fetch grades', error);
            } finally {
                setLoading(false);
            }
        };
        fetchGrades();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const getGradeColor = (score: number) => {
        if (score >= 80) return "text-green-600";
        if (score >= 70) return "text-blue-600";
        if (score >= 60) return "text-yellow-600";
        return "text-red-600";
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
                <p className="text-muted-foreground">Evaluation scores and feedback from your supervisors.</p>
            </div>

            {evaluations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No grades available yet.
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-3">
                    {['bimbingan', 'proposal', 'skripsi'].map((type) => {
                        const grade = evaluations.find(e => e.type === type);
                        return (
                            <Card key={type} className="flex flex-col">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="capitalize">{type}</CardTitle>
                                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <CardDescription>
                                        {grade ? `Evaluated by Lecturer` : 'Not yet evaluated'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4 grow flex flex-col justify-between">
                                    {grade ? (
                                        <>
                                            <div className={`text-4xl font-bold mb-4 ${getGradeColor(grade.score)}`}>
                                                {grade.score}
                                            </div>
                                            {grade.feedback && (
                                                <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground italic">
                                                    &quot;{grade.feedback}&quot;
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-6 text-muted-foreground">
                                            -
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
