'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';
import { useEvaluationSummary } from '../hooks/use-evaluation-summary';

const TYPE_LABELS: Record<string, string> = {
    SEMPRO: 'SEMPRO (Seminar Proposal)',
    BIMBINGAN_SEMPRO: 'Bimbingan SEMPRO',
    SIDANG_TA: 'SIDANG TA (Sidang Tugas Akhir)',
    BIMBINGAN_TA: 'Bimbingan TA',
    EXPO: 'EXPO',
    BIMBINGAN_EXPO: 'Bimbingan EXPO',
    MILESTONE: 'MILESTONE',
};

interface EvaluationSummaryFeatureProps {
    scheduleId: string;
}

export function EvaluationSummaryFeature({ scheduleId }: EvaluationSummaryFeatureProps) {
    const { data, loading, refetch, exportCSV, exporting } = useEvaluationSummary(scheduleId);

    if (loading) {
        return (
            <div className="container mx-auto py-6">
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container mx-auto py-6">
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Failed to load evaluation summary</p>
                    <Button onClick={() => refetch()} className="mt-4">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    const evaluationTypes = (() => {
        const types = new Set<string>();
        (data.summary ?? []).forEach((student) => {
            Object.keys(student.scores ?? {}).forEach((type) => types.add(type));
        });
        return Array.from(types);
    })();

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Link href="/admin/schedule">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Schedule
                        </Button>
                    </Link>
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Evaluation Summary</h1>
                        <p className="text-muted-foreground mt-1">
                            Complete evaluation results for {data.group.code || `Group ${data.group.id}`}
                        </p>
                    </div>
                    <Button onClick={() => exportCSV()} disabled={exporting}>
                        {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Export CSV
                    </Button>
                </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Schedule Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Type</p>
                            <Badge variant="secondary">{TYPE_LABELS[data.schedule.type] || data.schedule.type}</Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="font-medium">{formatDateTime(data.schedule.date)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Room</p>
                            <p className="font-medium">{data.schedule.room}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Group</p>
                            <p className="font-medium">{data.group.code || `Group ${data.group.id}`}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {evaluationTypes.length > 0 ? (
                <Tabs defaultValue={evaluationTypes[0]} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto">
                        {evaluationTypes.map((type) => (
                            <TabsTrigger key={type} value={type}>
                                {TYPE_LABELS[type] || type}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {evaluationTypes.map((type) => (
                        <TabsContent key={type} value={type} className="space-y-6">
                            {(data.summary ?? []).map((studentData) => (
                                <Card key={studentData.student.id}>
                                    <CardHeader>
                                        <CardTitle className="text-lg">
                                            {studentData.student.name}
                                            <span className="text-sm font-normal text-muted-foreground ml-2">
                                                ({studentData.student.nim})
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {studentData.scores[type]?.length > 0 ? (
                                            <div className="space-y-4">
                                                {studentData.scores[type].map((evaluatorData, idx) => (
                                                    <div key={idx} className="border rounded-lg p-4">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div>
                                                                <p className="font-medium">{evaluatorData.evaluator.name}</p>
                                                                <Badge variant="outline" className="mt-1">
                                                                    {evaluatorData.evaluator.role}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm text-muted-foreground">Weighted Average</p>
                                                                <p className="text-2xl font-bold">{evaluatorData.weighted_average}</p>
                                                            </div>
                                                        </div>

                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Component</TableHead>
                                                                    <TableHead className="text-right">Weight</TableHead>
                                                                    <TableHead className="text-right">Score</TableHead>
                                                                    <TableHead className="text-right">Weighted</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {evaluatorData.scores.map((score, scoreIdx) => (
                                                                    <TableRow key={scoreIdx}>
                                                                        <TableCell>{score.component}</TableCell>
                                                                        <TableCell className="text-right">{score.weight}%</TableCell>
                                                                        <TableCell className="text-right">{score.score}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            {((Number(score.score) * Number(score.weight)) / 100).toFixed(2)}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                                                No evaluation data available for this type
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </TabsContent>
                    ))}
                </Tabs>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No evaluation data available yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Evaluations will appear here once examiners and supervisors submit their scores
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
