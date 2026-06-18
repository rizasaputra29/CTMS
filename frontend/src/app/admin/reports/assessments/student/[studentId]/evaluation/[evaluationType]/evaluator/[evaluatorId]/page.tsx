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
    Award,
    ChevronDown,
    ChevronUp,
    FileText
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
    evaluator_id: number;
    name: string;
    role: string;
    status: 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED';
    score: number | null;
    total_components: number;
    scored_components: number;
    components: ComponentData[];
    calculation_summary: CalculationBreakdown;
    last_evaluated_at: string | null;
}

interface StudentInfo {
    id: number;
    name: string;
    nim: string;
    group_id: number;
    group_name: string;
}

interface EvaluatorDetailResponse {
    student: StudentInfo;
    evaluation_type: string;
    evaluator: EvaluatorData;
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
    EXAMINER_1: 'Examiner 1',
    EXAMINER_2: 'Examiner 2',
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

export default function EvaluatorDetailPage() {
    const searchParams = useSearchParams();
    const periodId = searchParams.get('period_id');
    const studentId = useStringParam('studentId');
    const evaluationType = useStringParam('evaluationType');
    const evaluatorId = useStringParam('evaluatorId');
    
    const [data, setData] = useState<EvaluatorDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [isComponentsOpen, setIsComponentsOpen] = useState(true);
    const [isCalculationOpen, setIsCalculationOpen] = useState(true);

    useEffect(() => {
        if (!periodId || !studentId || !evaluationType || !evaluatorId) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/admin/reports/evaluator-detail/${studentId}/${evaluationType}/${evaluatorId}`, {
                    params: { period_id: periodId }
                });
                setData(res.data);
            } catch (error) {
                console.error('Failed to fetch evaluator detail', error);
                toast.error('Failed to load evaluator data');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [periodId, studentId, evaluationType, evaluatorId]);

    const handleExport = () => {
        if (!data) return;
        
        const evaluator = data.evaluator;
        const studentName = data.student.name.replace(/\s+/g, '_');
        const evalLabel = (EVALUATION_LABELS[evaluationType ?? ''] || evaluationType || 'Unknown').replace(/\s+/g, '_');
        const evaluatorName = evaluator.name.replace(/\s+/g, '_');
        
        // Build CSV content
        const csvRows: string[][] = [];
        
        // Add header
        csvRows.push(['Evaluator Detail Report']);
        csvRows.push([]);
        csvRows.push(['Student', data.student.name]);
        csvRows.push(['NIM', data.student.nim]);
        csvRows.push(['Group', data.student.group_name]);
        csvRows.push(['Evaluation Type', EVALUATION_LABELS[evaluationType ?? ''] || evaluationType || 'Unknown']);
        csvRows.push([]);
        csvRows.push(['Evaluator', evaluator.name]);
        csvRows.push(['Role', ROLE_LABELS[evaluator.role] || evaluator.role]);
        csvRows.push(['Status', evaluator.status]);
        csvRows.push(['Score', evaluator.score?.toString() || 'N/A']);
        csvRows.push([]);
        
        // Add components
        csvRows.push(['Components']);
        csvRows.push(['Component', 'Code', 'Weight', 'Normalized Weight', 'Score', 'Notes', 'Date']);
        
        (evaluator.components ?? []).forEach(component => {
            csvRows.push([
                component.component_name,
                component.component_code,
                `${component.weight}%`,
                `${component.normalized_weight?.toFixed(1) ?? '–'}%`,
                component.score?.toString() || 'N/A',
                component.notes || '',
                component.evaluated_at || 'Not evaluated'
            ]);
        });
        
        // Add calculation breakdown
        csvRows.push([]);
        csvRows.push(['Calculation Breakdown']);
        csvRows.push(['Component', 'Score', 'Weight', 'Weighted Score']);
        
        (evaluator.calculation_summary?.breakdown ?? []).forEach(item => {
            csvRows.push([
                item.component,
                item.score.toString(),
                `${item.weight}%`,
                item.weighted.toFixed(2)
            ]);
        });
        
        csvRows.push([]);
        csvRows.push(['Final Score', evaluator.calculation_summary.final_score?.toFixed(2) || 'N/A']);
        
        // Convert to CSV
        const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${studentName}_${evalLabel}_${evaluatorName}_detail.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Evaluator detail exported');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Evaluator Detail</h1>
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
                    <Link href={`/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}?period_id=${periodId}`}>
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

    const evaluator = data.evaluator;
    const statusConfig = getStatusConfig(evaluator.status);
    const StatusIcon = statusConfig.icon;
    const progressPercent = evaluator.total_components > 0 
        ? (evaluator.scored_components / evaluator.total_components) * 100 
        : 0;

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Link href="/admin/reports" className="hover:underline">Reports</Link>
                <span>/</span>
                <Link href={`/admin/reports/assessments?period_id=${periodId}`} className="hover:underline">Assessment Scores</Link>
                <span>/</span>
                <Link href={`/admin/reports/assessments/student/${studentId}?period_id=${periodId}`} className="hover:underline">
                    {data.student.name}
                </Link>
                <span>/</span>
                <Link href={`/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}?period_id=${periodId}`} className="hover:underline">
                    {EVALUATION_LABELS[evaluationType ?? ''] || evaluationType}
                </Link>
                <span>/</span>
                <span className="text-foreground font-medium">{evaluator.name}</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{evaluator.name}</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {ROLE_LABELS[evaluator.role] || evaluator.role}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    {statusConfig.badge}
                </div>
            </div>

            {/* Evaluator Summary Card */}
            <Card className={`${statusConfig.borderColor} ${statusConfig.bgColor}`}>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center md:text-left">
                            <div className="text-sm text-muted-foreground mb-1">Score</div>
                            <div className={`text-5xl font-bold ${getScoreColor(evaluator.score)}`}>
                                {evaluator.score !== null ? evaluator.score.toFixed(2) : '–'}
                            </div>
                            <div className="text-sm text-muted-foreground">/ 100</div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-white">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Components</div>
                                <div className="text-2xl font-bold">
                                    {evaluator.scored_components}/{evaluator.total_components}
                                </div>
                                <div className="text-xs text-muted-foreground">scored</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <StatusIcon className={`h-10 w-10 ${statusConfig.textColor}`} />
                            <div>
                                <div className="text-sm text-muted-foreground">Status</div>
                                <div className="text-lg font-bold">{evaluator.status}</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Components Section */}
            <Collapsible open={isComponentsOpen} onOpenChange={setIsComponentsOpen}>
                <Card>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    <CardTitle>All Components</CardTitle>
                                    <span className="text-sm text-muted-foreground">
                                        ({evaluator.total_components} total)
                                    </span>
                                </div>
                                {isComponentsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                        </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                        <CardContent className="space-y-6 pt-2">
                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Completion Progress</span>
                                    <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
                                </div>
                                <Progress value={progressPercent} className="h-2" />
                            </div>

                            {/* Components Table - All components, scored and unscored */}
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[35%]">Component</TableHead>
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
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Calculation Breakdown Section - Shows all components including unscored with 0 contribution */}
            <Collapsible open={isCalculationOpen} onOpenChange={setIsCalculationOpen}>
                <Card>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Calculator className="h-5 w-5" />
                                    <CardTitle>Calculation Breakdown</CardTitle>
                                    <span className="text-xs text-muted-foreground">({evaluator.calculation_summary.formula})</span>
                                </div>
                                {isCalculationOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                        </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                        <CardContent className="pt-2">
                            <div className="border rounded-lg overflow-hidden">
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
                                            <TableRow key={idx} className={item.score === 0 ? 'bg-gray-50/30' : ''}>
                                                <TableCell className="font-medium">{item.component}</TableCell>
                                                <TableCell className="text-center">
                                                    {item.score !== 0 ? item.score : <span className="text-muted-foreground">–</span>}
                                                </TableCell>
                                                <TableCell className="text-center text-muted-foreground">×</TableCell>
                                                <TableCell className="text-center font-medium text-blue-600">{item.weight}%</TableCell>
                                                <TableCell className="text-center text-muted-foreground">=</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {item.weighted > 0 ? item.weighted.toFixed(2) : <span className="text-muted-foreground">–</span>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="border-t-2 bg-muted/30">
                                            <TableCell colSpan={3} className="text-right font-bold">
                                                Total Weight: {evaluator.calculation_summary.total_weight}%
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground">÷</TableCell>
                                            <TableCell className="text-center font-bold">{evaluator.calculation_summary.total_weight}</TableCell>
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
                                                    Final Score
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
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        </div>
    );
}
