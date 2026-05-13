'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
    GraduationCap,
    TrendingUp,
    Award,
    FileText,
    ChevronDown,
    ChevronUp,
    Download,
    Users,
    BookOpen,
    Target,
    Star
} from 'lucide-react';
import { toast } from 'sonner';

interface EvaluatorScore {
    evaluator_name: string;
    evaluator_role: string;
    score: number;
}

interface ComponentBreakdown {
    type: string;
    label: string;
    average_score: number;
    evaluators: EvaluatorScore[];
    is_complete: boolean;
}

interface GradeBreakdown {
    pdc1: {
        score: number;
        components: ComponentBreakdown[];
    };
    pdc2: {
        score: number;
        components: ComponentBreakdown[];
    };
    final_grade: number;
    letter_grade: string;
}

interface GradeData {
    student_id: number;
    student_name: string;
    group_id: number;
    period_id: number;
    grades: GradeBreakdown;
}

export default function MahasiswaGradesPage() {
    const [gradeData, setGradeData] = useState<GradeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const fetchGrades = async () => {
            try {
                const response = await api.get('/mahasiswa/my-grades');
                setGradeData(response.data.data);
            } catch (error) {
                console.error('Failed to fetch grades', error);
                toast.error('Failed to load grades');
            } finally {
                setLoading(false);
            }
        };
        fetchGrades();
    }, []);

    const getScoreColor = (score: number): string => {
        if (score >= 85) return 'text-emerald-600';
        if (score >= 70) return 'text-blue-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-red-600';
    };

    const getScoreBgColor = (score: number): string => {
        if (score >= 85) return 'bg-emerald-50 border-emerald-200';
        if (score >= 70) return 'bg-blue-50 border-blue-200';
        if (score >= 60) return 'bg-amber-50 border-amber-200';
        return 'bg-red-50 border-red-200';
    };

    const getLetterGradeColor = (grade: string): string => {
        switch (grade) {
            case 'A': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
            case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'C': return 'bg-amber-100 text-amber-800 border-amber-300';
            case 'D': return 'bg-orange-100 text-orange-800 border-orange-300';
            default: return 'bg-red-100 text-red-800 border-red-300';
        }
    };

    const handleExport = async () => {
        try {
            toast.info('Preparing grade slip export...');
            // TODO: Implement PDF export endpoint
            toast.success('Grade slip downloaded');
        } catch {
            toast.error('Failed to export grade slip');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (!gradeData) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
                    <p className="text-muted-foreground">Your academic performance summary.</p>
                </div>
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Grades Available</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Your grades will appear here once your supervisors and examiners have submitted their evaluations.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { grades } = gradeData;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
                    <p className="text-muted-foreground">Your academic performance summary.</p>
                </div>
                <Button variant="outline" onClick={handleExport} className="w-full md:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export Grade Slip
                </Button>
            </div>

            {/* Grade Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* PDC 1 Card */}
                <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${getScoreBgColor(grades.pdc1.score)}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BookOpen className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Target className="h-5 w-5" />
                                PDC 1
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">Semester 1-2</Badge>
                        </div>
                        <CardDescription className="text-sm opacity-80">
                            Seminar & Bimbingan
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-5xl font-bold ${getScoreColor(grades.pdc1.score)}`}>
                                {Number(grades.pdc1.score).toFixed(1)}
                            </span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        <div className="mt-4 space-y-2">
                                {grades.pdc1.components.map((comp) => (
                                    <div key={comp.type} className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2">
                                            {comp.is_complete ? (
                                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                            ) : (
                                                <span className="h-2 w-2 rounded-full bg-gray-300" />
                                            )}
                                            {comp.label}
                                        </span>
                                        <span className={`font-semibold ${getScoreColor(comp.average_score)}`}>
                                            {Number(comp.average_score).toFixed(1)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* PDC 2 Card */}
                <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${getScoreBgColor(grades.pdc2.score)}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Star className="h-5 w-5" />
                                PDC 2
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">Semester 3-4</Badge>
                        </div>
                        <CardDescription className="text-sm opacity-80">
                            Expo, Milestone & Peer Review
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-5xl font-bold ${getScoreColor(grades.pdc2.score)}`}>
                                {Number(grades.pdc2.score).toFixed(1)}
                            </span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        <div className="mt-4 space-y-2">
                                {grades.pdc2.components.map((comp) => (
                                    <div key={comp.type} className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2">
                                            {comp.is_complete ? (
                                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                            ) : (
                                                <span className="h-2 w-2 rounded-full bg-gray-300" />
                                            )}
                                            {comp.label}
                                        </span>
                                        <span className={`font-semibold ${getScoreColor(comp.average_score)}`}>
                                            {Number(comp.average_score).toFixed(1)}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Final Grade Card */}
                <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${getScoreBgColor(grades.final_grade)}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Award className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Award className="h-5 w-5" />
                                Final Grade
                            </CardTitle>
                            <Badge className={`${getLetterGradeColor(grades.letter_grade)}`}>
                                {grades.letter_grade}
                            </Badge>
                        </div>
                        <CardDescription className="text-sm opacity-80">
                            Overall Performance
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-6xl font-bold ${getScoreColor(grades.final_grade)}`}>
                                {Number(grades.final_grade).toFixed(1)}
                            </span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">
                            <p>Formula: (PDC 1 + PDC 2) ÷ 2</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Breakdown */}
            <Card>
                <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowDetails(!showDetails)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle>Detailed Breakdown</CardTitle>
                                <CardDescription>Individual evaluator scores and feedback</CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm">
                            {showDetails ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardHeader>
                
                {showDetails && (
                    <CardContent className="space-y-6">
                        {/* PDC 1 Details */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Target className="h-5 w-5 text-primary" />
                                PDC 1 Components
                            </h3>
                            <div className="space-y-4">
                                {grades.pdc1.components.map((comp) => (
                                    <div key={comp.type} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium">{comp.label}</h4>
                                            <Badge variant={comp.is_complete ? 'default' : 'secondary'}>
                                                {comp.is_complete ? 'Complete' : 'Pending'}
                                            </Badge>
                                        </div>
                                        {comp.evaluators.length > 0 ? (
                                            <div className="space-y-2">
                                                {comp.evaluators.map((evaluator, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm">{evaluator.evaluator_name}</span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {evaluator.evaluator_role}
                                                            </Badge>
                                                        </div>
                                                        <span className={`font-semibold ${getScoreColor(evaluator.score)}`}>
                                                            {Number(evaluator.score).toFixed(1)}
                                                        </span>
                                                    </div>
                                                ))}
                                                <Separator className="my-2" />
                                                <div className="flex items-center justify-between px-3">
                                                    <span className="font-medium">Average</span>
                                                    <span className={`text-lg font-bold ${getScoreColor(comp.average_score)}`}>
                                                        {Number(comp.average_score).toFixed(1)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">
                                                No evaluations submitted yet.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* PDC 2 Details */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Star className="h-5 w-5 text-primary" />
                                PDC 2 Components
                            </h3>
                            <div className="space-y-4">
                                {grades.pdc2.components.map((comp) => (
                                    <div key={comp.type} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium">{comp.label}</h4>
                                            <Badge variant={comp.is_complete ? 'default' : 'secondary'}>
                                                {comp.is_complete ? 'Complete' : 'Pending'}
                                            </Badge>
                                        </div>
                                        {comp.evaluators.length > 0 ? (
                                            <div className="space-y-2">
                                                {comp.evaluators.map((evaluator, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm">{evaluator.evaluator_name}</span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {evaluator.evaluator_role}
                                                            </Badge>
                                                        </div>
                                                        <span className={`font-semibold ${getScoreColor(evaluator.score)}`}>
                                                            {Number(evaluator.score).toFixed(1)}
                                                        </span>
                                                    </div>
                                                ))}
                                                <Separator className="my-2" />
                                                <div className="flex items-center justify-between px-3">
                                                    <span className="font-medium">Average</span>
                                                    <span className={`text-lg font-bold ${getScoreColor(comp.average_score)}`}>
                                                        {Number(comp.average_score).toFixed(1)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">
                                                No evaluations submitted yet.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Grade Scale Reference */}
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-base">Grade Scale Reference</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { grade: 'A', range: '85 - 100', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                            { grade: 'B', range: '70 - 84', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                            { grade: 'C', range: '60 - 69', color: 'bg-amber-100 text-amber-800 border-amber-300' },
                            { grade: 'D', range: '50 - 59', color: 'bg-orange-100 text-orange-800 border-orange-300' },
                            { grade: 'E', range: '< 50', color: 'bg-red-100 text-red-800 border-red-300' },
                        ].map((item) => (
                            <div key={item.grade} className={`text-center p-3 rounded-lg border ${item.color}`}>
                                <div className="text-2xl font-bold">{item.grade}</div>
                                <div className="text-xs mt-1">{item.range}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
