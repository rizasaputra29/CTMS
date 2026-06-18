'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    ArrowLeft, 
    Loader2, 
    Download,
    GraduationCap,
    Calculator,
    CheckCircle2,
    AlertCircle,
    MinusCircle,
    User,
    Calendar,
    Users,
    Award,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useStringParam } from '@/hooks/use-params';

interface ComponentData {
    component_id: number;
    component_code: string;
    component_name: string;
    weight: number;
    normalized_weight: number;
    score: number | null;
    notes: string | null;
    evaluated_at: string | null;
}

interface CalculationBreakdown {
    formula: string;
    breakdown: Array<{
        component: string;
        score: number;
        weight: number;
        weighted: number;
    }>;
    total_weight: number;
    weighted_sum: number;
    final_score: number | null;
}

interface EvaluatorData {
    evaluator_id: number | null;
    name: string;
    role: string;
    status: 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED';
    score: number | null;
    total_components: number;
    scored_components: number;
    components: ComponentData[];
    calculation_summary: CalculationBreakdown;
}

interface UnassignedData {
    components: Array<{
        component_id: number;
        component_code: string;
        component_name: string;
        weight: number;
        score: number | null;
        notes: string | null;
        evaluated_at: string | null;
    }>;
    total: number;
}

interface EvaluationDetail {
    student: {
        id: number;
        name: string;
        nim: string;
        group_id: number;
        group_name: string;
    };
    evaluation_type: string;
    overall: {
        score: number | null;
        status: 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED';
        total_evaluators: number;
        completed_evaluators: number;
        last_evaluated_at: string | null;
    };
    evaluators: EvaluatorData[];
    unassigned: UnassignedData;
}

const EVALUATION_LABELS: Record<string, string> = {
    SEMPRO: 'Seminar Proposal',
    BIMBINGAN_SEMPRO: 'Bimbingan Sempro',
    SIDANG_TA: 'Sidang TA',
    BIMBINGAN_TA: 'Bimbingan TA',
    EXPO: 'Expo',
    MILESTONE: 'Milestone',
    NILAI_DOSEN: 'Nilai Dosen',
};

const ROLE_LABELS: Record<string, string> = {
    SUPERVISOR_1: 'Supervisor 1',
    SUPERVISOR_2: 'Supervisor 2',
    EXAMINER: 'Examiner',
    Evaluator: 'Evaluator',
};

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'COMPLETE':
            return {
                icon: CheckCircle2,
                badge: <Badge className="bg-emerald-100 text-emerald-800">Complete</Badge>,
                borderColor: 'border-emerald-200',
                bgColor: 'bg-emerald-50',
                textColor: 'text-emerald-600',
            };
        case 'PARTIAL':
            return {
                icon: AlertCircle,
                badge: <Badge className="bg-amber-100 text-amber-800">Partial</Badge>,
                borderColor: 'border-amber-200',
                bgColor: 'bg-amber-50',
                textColor: 'text-amber-600',
            };
        case 'NOT_STARTED':
        default:
            return {
                icon: MinusCircle,
                badge: <Badge variant="secondary">Not Started</Badge>,
                borderColor: 'border-gray-200',
                bgColor: 'bg-gray-50',
                textColor: 'text-gray-600',
            };
    }
};

const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-400';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
};

function EvaluatorSection({ evaluator, index, studentId, evaluationType, periodId }: { evaluator: EvaluatorData; index: number; studentId: string | null; evaluationType: string | null; periodId: string | null }) {
    const [isOpen, setIsOpen] = useState(true);
    const statusConfig = getStatusConfig(evaluator.status);
    const progressPercent = evaluator.total_components > 0 
        ? (evaluator.scored_components / evaluator.total_components) * 100 
        : 0;

    const colors = [
        { border: 'border-blue-200', bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600' },
        { border: 'border-primary-200', bg: 'bg-primary-50', icon: 'bg-primary-100 text-primary-500' },
        { border: 'border-emerald-200', bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600' },
        { border: 'border-orange-200', bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600' },
    ];
    const color = colors[index % colors.length];

    const evaluatorDetailUrl = evaluator.evaluator_id && studentId && evaluationType
        ? `/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}/evaluator/${evaluator.evaluator_id}?period_id=${periodId}`
        : null;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className={`${color.border} overflow-hidden`}>
                {/* Evaluator Header - Always visible */}
                <CollapsibleTrigger asChild>
                    <CardHeader className={`${color.bg} cursor-pointer hover:brightness-95 transition-all`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${color.icon}`}>
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">
                                        {evaluatorDetailUrl ? (
                                            <Link href={evaluatorDetailUrl} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                                {evaluator.name}
                                            </Link>
                                        ) : (
                                            evaluator.name
                                        )}
                                    </CardTitle>
                                    <CardDescription className="text-sm mt-1">
                                        {ROLE_LABELS[evaluator.role] || evaluator.role}
                                    </CardDescription>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className={`text-3xl font-bold ${getScoreColor(evaluator.score)}`}>
                                        {evaluator.score !== null ? evaluator.score.toFixed(2) : '–'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Score</div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1">
                                    {statusConfig.badge}
                                    <span className="text-xs text-muted-foreground">
                                        {evaluator.scored_components}/{evaluator.total_components} components
                                    </span>
                                </div>
                                
                                {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                            </div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <CardContent className="space-y-6 pt-6">
                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Component Completion</span>
                                <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                        </div>

                        {/* Components Table - No Evaluator Column */}
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[40%]">Component</TableHead>
                                        <TableHead className="text-center">Weight</TableHead>
                                        <TableHead className="text-center">N.Weight</TableHead>
                                        <TableHead className="text-center">Score</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead className="text-right">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {evaluator.components.map((component) => (
                                        <TableRow key={component.component_id} className={component.score === null ? 'bg-gray-50/50' : ''}>
                                            <TableCell>
                                                <div className="font-medium">{component.component_name}</div>
                                                <div className="text-xs text-muted-foreground">{component.component_code}</div>
                                            </TableCell>
                                            <TableCell className="text-center">{component.weight}%</TableCell>
                                            <TableCell className="text-center font-medium text-blue-600">
                                                {component.normalized_weight?.toFixed(1) ?? '–'}%
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {component.score !== null ? (
                                                    <span className={`font-bold ${getScoreColor(component.score)}`}>
                                                        {component.score}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">–</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {component.notes ? (
                                                    <div className="max-w-[150px] truncate" title={component.notes}>
                                                        {component.notes}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">–</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {component.evaluated_at || '–'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Calculation Breakdown - Per Evaluator, weights sum to 100% */}
                        {evaluator.calculation_summary.breakdown.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-3 border-b">
                                    <div className="flex items-center gap-2">
                                        <Calculator className="h-4 w-4" />
                                        <span className="font-medium">Calculation Breakdown</span>
                                        <span className="text-xs text-muted-foreground">({evaluator.calculation_summary.formula})</span>
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead>Component</TableHead>
                                            <TableHead className="text-center">Score</TableHead>
                                            <TableHead className="text-center">×</TableHead>
                                            <TableHead className="text-center">Weight</TableHead>
                                            <TableHead className="text-center">=</TableHead>
                                            <TableHead className="text-right">Weighted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {evaluator.calculation_summary.breakdown.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{item.component}</TableCell>
                                                <TableCell className="text-center">{item.score}</TableCell>
                                                <TableCell className="text-center text-muted-foreground">×</TableCell>
                                                <TableCell className="text-center font-medium text-blue-600">{item.weight}%</TableCell>
                                                <TableCell className="text-center text-muted-foreground">=</TableCell>
                                                <TableCell className="text-right font-medium">{item.weighted.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="border-t-2 bg-muted/30">
                                            <TableCell colSpan={3} className="text-right font-bold">
                                                Total Weight: 100%
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground">÷</TableCell>
                                            <TableCell className="text-center font-bold">100</TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-lg font-bold text-blue-600">
                                                    {evaluator.calculation_summary.weighted_sum.toFixed(2)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className="bg-muted/50">
                                            <TableCell colSpan={5} className="text-right">
                                                <div className="flex items-center justify-end gap-2 font-bold text-lg">
                                                    <Award className="h-5 w-5" />
                                                    Evaluator Score
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={`text-2xl font-bold ${getScoreColor(evaluator.calculation_summary.final_score)}`}>
                                                    {evaluator.calculation_summary.final_score !== null 
                                                        ? evaluator.calculation_summary.final_score.toFixed(2) 
                                                        : '–'}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

export default function EvaluationDetailPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    const studentId = useStringParam('studentId');
    const evaluationType = useStringParam('evaluationType');
    
    const [data, setData] = useState<EvaluationDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!periodId || !studentId || !evaluationType) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/admin/reports/student-evaluations/${studentId}/${evaluationType}`, {
                    params: { period_id: periodId }
                });
                setData(res.data);
            } catch (error) {
                console.error('Failed to fetch evaluation detail', error);
                toast.error('Failed to load evaluation data');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [periodId, studentId, evaluationType]);

    const handleExport = () => {
        if (!data || !evaluationType) return;
        
        const studentName = data.student.name.replace(/\s+/g, '_');
        const evalLabel = (EVALUATION_LABELS[evaluationType] || evaluationType).replace(/\s+/g, '_');
        
        // Build CSV content with all evaluator data
        const csvRows: string[][] = [];
        
        // Add header with student info
        csvRows.push(['Student', data.student.name]);
        csvRows.push(['NIM', data.student.nim]);
        csvRows.push(['Group', data.student.group_name]);
        csvRows.push(['Evaluation Type', evaluationType ? EVALUATION_LABELS[evaluationType] || evaluationType : 'Unknown']);
        csvRows.push(['Overall Score', data.overall.score?.toString() || 'N/A']);
        csvRows.push(['Status', data.overall.status]);
        csvRows.push([]);
        csvRows.push([]);
        
        // Add evaluators data
        csvRows.push(['EVALUATORS']);
        csvRows.push(['Evaluator Name', 'Role', 'Status', 'Score', 'Components Scored', 'Total Components']);
        
        (data.evaluators ?? []).forEach(evaluator => {
            csvRows.push([
                evaluator.name,
                ROLE_LABELS[evaluator.role] || evaluator.role,
                evaluator.status,
                evaluator.score?.toString() || 'N/A',
                evaluator.scored_components.toString(),
                evaluator.total_components.toString()
            ]);
        });
        
        // Add component details for each evaluator
        csvRows.push([]);
        csvRows.push([]);
        csvRows.push(['COMPONENT DETAILS']);
        
        (data.evaluators ?? []).forEach(evaluator => {
            csvRows.push([]);
            csvRows.push(['Evaluator', evaluator.name]);
            csvRows.push(['Component', 'Weight', 'Normalized Weight', 'Score', 'Notes', 'Date']);
            
            (evaluator.components ?? []).forEach(component => {
                csvRows.push([
                    `${component.component_name} (${component.component_code})`,
                    `${component.weight}%`,
                    `${component.normalized_weight}%`,
                    component.score?.toString() || 'N/A',
                    component.notes || '',
                    component.evaluated_at || 'Not evaluated'
                ]);
            });
        });
        
        // Add unassigned components if any
        if (data.unassigned?.total > 0) {
            csvRows.push([]);
            csvRows.push([]);
            csvRows.push(['UNASSIGNED COMPONENTS']);
            csvRows.push(['Component', 'Weight', 'Score', 'Notes', 'Date']);
            
            (data.unassigned?.components ?? []).forEach(component => {
                csvRows.push([
                    `${component.component_name} (${component.component_code})`,
                    `${component.weight}%`,
                    component.score?.toString() || 'N/A',
                    component.notes || '',
                    component.evaluated_at || 'Not evaluated'
                ]);
            });
        }
        
        // Convert to CSV
        const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${studentName}_${evalLabel}_evaluation_detail.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Evaluation detail exported');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments/student/${studentId}?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Evaluation Detail</h1>
                </div>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments/student/${studentId}?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Evaluation Not Found</h1>
                </div>
                <Card>
                    <CardContent className="py-12 text-center">
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">Evaluation data not found.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const overallStatusConfig = getStatusConfig(data.overall.status);
    const OverallIcon = overallStatusConfig.icon;

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/admin/reports" className="hover:underline">Reports</Link>
                <span>/</span>
                <Link href={`/admin/reports/assessments?period_id=${periodId}`} className="hover:underline">Assessment Scores</Link>
                <span>/</span>
                <Link href={`/admin/reports/assessments/student/${studentId}?period_id=${periodId}`} className="hover:underline">
                    {data.student.name}
                </Link>
                <span>/</span>
                <span className="text-foreground">{evaluationType ? EVALUATION_LABELS[evaluationType] || evaluationType : 'Unknown'}</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments/student/${studentId}?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{evaluationType ? EVALUATION_LABELS[evaluationType] || evaluationType : 'Unknown'}</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {data.student.name} • {data.student.nim}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    {overallStatusConfig.badge}
                </div>
            </div>

            {/* Overall Summary Card */}
            <Card className={`${overallStatusConfig.borderColor} ${overallStatusConfig.bgColor}`}>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="text-center md:text-left">
                            <div className="text-sm text-muted-foreground mb-1">Average Score</div>
                            <div className={`text-5xl font-bold ${getScoreColor(data.overall.score)}`}>
                                {data.overall.score !== null ? data.overall.score.toFixed(2) : '–'}
                            </div>
                            <div className="text-sm text-muted-foreground">/ 100</div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-white">
                                <Users className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Evaluators</div>
                                <div className="text-2xl font-bold">
                                    {data.overall.completed_evaluators}/{data.overall.total_evaluators}
                                </div>
                                <div className="text-xs text-muted-foreground">completed</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <OverallIcon className={`h-10 w-10 ${overallStatusConfig.textColor}`} />
                            <div>
                                <div className="text-sm text-muted-foreground">Status</div>
                                <div className="text-lg font-bold">{data.overall.status}</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <Calendar className="h-10 w-10 text-muted-foreground" />
                            <div>
                                <div className="text-sm text-muted-foreground">Last Evaluated</div>
                                <div className="text-lg font-bold">
                                    {data.overall.last_evaluated_at || 'Not yet'}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Evaluators */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Evaluator Scores
                    <span className="text-sm font-normal text-muted-foreground">
                        ({data.evaluators.length} evaluators)
                    </span>
                </h2>
                
                {data.evaluators.map((evaluator, index) => (
                    <EvaluatorSection 
                        key={evaluator.evaluator_id || index} 
                        evaluator={evaluator} 
                        index={index} 
                        studentId={studentId}
                        evaluationType={evaluationType}
                        periodId={periodId}
                    />
                ))}
            </div>

            {/* Unassigned Components */}
            {data.unassigned.total > 0 && (
                <Card className="border-red-200 bg-red-50/50">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="h-5 w-5" />
                            <CardTitle>Unassigned Components</CardTitle>
                        </div>
                        <CardDescription className="text-red-600">
                            {data.unassigned.total} component(s) without assigned evaluator
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Component</TableHead>
                                    <TableHead className="text-center">Weight</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.unassigned.components.map((component) => (
                                    <TableRow key={component.component_id} className="bg-red-50/30">
                                        <TableCell>
                                            <div className="font-medium">{component.component_name}</div>
                                            <div className="text-xs text-muted-foreground">{component.component_code}</div>
                                        </TableCell>
                                        <TableCell className="text-center">{component.weight}%</TableCell>
                                        <TableCell className="text-center">
                                            {component.score !== null ? (
                                                <span className={`font-bold ${getScoreColor(component.score)}`}>
                                                    {component.score}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">–</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{component.notes || '–'}</TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {component.evaluated_at || '–'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
