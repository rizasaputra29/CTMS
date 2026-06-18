'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    ClipboardCheck,
    CheckCircle2,
    AlertCircle,
    MinusCircle,
    ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useStringParam } from '@/hooks/use-params';
import { getEvaluationData } from '@/types/guards';

interface EvaluationStatus {
    score: number | null;
    status: 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED';
    total_components: number;
    scored_components: number;
}

interface StudentEvaluations {
    student_id: number;
    student_name: string;
    student_nim: string;
    group_id: number;
    group_name: string;
    evaluations: {
        SEMPRO: EvaluationStatus;
        BIMBINGAN_SEMPRO: EvaluationStatus;
        SIDANG_TA: EvaluationStatus;
        BIMBINGAN_TA: EvaluationStatus;
        EXPO: EvaluationStatus;
        MILESTONE: EvaluationStatus;
        NILAI_DOSEN: EvaluationStatus;
    };
}

const EVALUATION_CONFIG = [
    { key: 'SEMPRO', label: 'Seminar Proposal', iconClass: 'bg-blue-100 text-blue-600' },
    { key: 'BIMBINGAN_SEMPRO', label: 'Bimbingan Sempro', iconClass: 'bg-cyan-100 text-cyan-600' },
    { key: 'SIDANG_TA', label: 'Sidang TA', iconClass: 'bg-emerald-100 text-emerald-600' },
    { key: 'BIMBINGAN_TA', label: 'Bimbingan TA', iconClass: 'bg-teal-100 text-teal-600' },
    { key: 'EXPO', label: 'Expo', iconClass: 'bg-amber-100 text-amber-600' },
    { key: 'MILESTONE', label: 'Milestone', iconClass: 'bg-orange-100 text-orange-600' },
    { key: 'NILAI_DOSEN', label: 'Nilai Dosen', iconClass: 'bg-primary-100 text-primary-500' },
];

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'COMPLETE':
            return {
                icon: CheckCircle2,
                badge: <Badge className="bg-emerald-100 text-emerald-800">Complete</Badge>,
                borderColor: 'border-emerald-200',
                bgColor: 'bg-emerald-50/50',
            };
        case 'PARTIAL':
            return {
                icon: AlertCircle,
                badge: <Badge className="bg-amber-100 text-amber-800">Partial</Badge>,
                borderColor: 'border-amber-200',
                bgColor: 'bg-amber-50/50',
            };
        case 'NOT_STARTED':
        default:
            return {
                icon: MinusCircle,
                badge: <Badge variant="secondary">Not Started</Badge>,
                borderColor: 'border-gray-200',
                bgColor: 'bg-gray-50/50',
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

export default function StudentAssessmentDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const periodId = searchParams.get('period_id');
    const studentId = useStringParam('studentId');
    
    const [data, setData] = useState<StudentEvaluations | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!periodId || !studentId) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch specific student by ID using a search parameter
                const res = await api.get('/admin/reports/student-evaluations-summary', {
                    params: {
                        period_id: periodId,
                        student_search: '', // Empty to get all
                        per_page: 100, // Max allowed by backend
                    }
                });
                
                // Find the specific student from all results
                const students = (res.data?.data ?? []) as StudentEvaluations[];
                const student = students.find((s: StudentEvaluations) =>
                    s.student_id === parseInt(studentId)
                );
                
                if (student) {
                    setData(student);
                } else if (res.data.meta.last_page > 1) {
                    // Student might be on another page — fetch remaining pages in parallel
                    const remainingPages = Math.min(res.data.meta.last_page, 10);
                    const pagePromises = Array.from({ length: remainingPages - 1 }, (_, i) =>
                        api.get('/admin/reports/student-evaluations-summary', {
                            params: {
                                period_id: periodId,
                                student_search: '',
                                per_page: 100,
                                page: i + 2,
                            }
                        })
                    );
                    const results = await Promise.all(pagePromises);

                    let found = false;
                    for (const pageRes of results) {
                        const match = (pageRes.data?.data || []).find((s: StudentEvaluations) =>
                            s.student_id === parseInt(studentId)
                        );
                        if (match) {
                            setData(match);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        toast.error('Student not found');
                    }
                } else {
                    toast.error('Student not found');
                }
            } catch (error) {
                console.error('Failed to fetch student evaluations', error);
                toast.error('Failed to load student data');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [periodId, studentId]);

    const handleEvaluationClick = (evaluationType: string) => {
        router.push(`/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}?period_id=${periodId}`);
    };

    const handleExport = () => {
        if (!data) return;
        
        // Build CSV content
        const headers = ['Evaluation Type', 'Score', 'Status', 'Components'];
        const rows = EVALUATION_CONFIG.map(config => {
            const evalData = getEvaluationData(data.evaluations, config.key);
            return [
                config.label,
            evalData?.score != null ? evalData.score.toString() : 'N/A',
                evalData?.status || 'NOT_STARTED',
                `${evalData?.scored_components || 0}/${evalData?.total_components || 0}`
            ];
        });
        
        // Convert to CSV
        const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `student_${data.student_name.replace(/\s+/g, '_')}_evaluations.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Student evaluation data exported');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Student Assessment Detail</h1>
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
                    <Link href={`/admin/reports/assessments?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Student Not Found</h1>
                </div>
                <Card>
                    <CardContent className="py-12 text-center">
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">Student not found in this period.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const completedCount = Object.values(data.evaluations).filter(e => e.status === 'COMPLETE').length;
    const partialCount = Object.values(data.evaluations).filter(e => e.status === 'PARTIAL').length;
    const notStartedCount = Object.values(data.evaluations).filter(e => e.status === 'NOT_STARTED').length;

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/admin/reports" className="hover:underline">Reports</Link>
                <span>/</span>
                <Link href={`/admin/reports/assessments?period_id=${periodId}`} className="hover:underline">Assessment Scores</Link>
                <span>/</span>
                <span className="text-foreground">{data.student_name}</span>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/admin/reports/assessments?period_id=${periodId}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{data.student_name}</h1>
                        <p className="text-muted-foreground">
                            {data.student_nim} • {data.group_name}
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Evaluations</CardDescription>
                        <CardTitle className="text-3xl">7</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-emerald-200">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-600">Complete</CardDescription>
                        <CardTitle className="text-3xl text-emerald-600">{completedCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-amber-200">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-amber-600">Partial</CardDescription>
                        <CardTitle className="text-3xl text-amber-600">{partialCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-gray-200">
                    <CardHeader className="pb-2">
                        <CardDescription>Not Started</CardDescription>
                        <CardTitle className="text-3xl text-gray-600">{notStartedCount}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Evaluation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {EVALUATION_CONFIG.map((config) => {
                    const evalData = getEvaluationData(data.evaluations, config.key);
                    const statusConfig = getStatusConfig(evalData?.status ?? 'NOT_STARTED');
                    const Icon = statusConfig.icon;
                    const progressPercent = (evalData?.total_components ?? 0) > 0
                        ? ((evalData?.scored_components ?? 0) / (evalData?.total_components ?? 1)) * 100
                        : 0;
                    
                    return (
                        <Card 
                            key={config.key}
                            className={`cursor-pointer transition-all hover:shadow-md ${statusConfig.borderColor} ${statusConfig.bgColor}`}
                            onClick={() => handleEvaluationClick(config.key)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${config.iconClass}`}>
                                            <ClipboardCheck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{config.label}</CardTitle>
                                            <CardDescription className="text-xs">
                                                {config.key}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Icon className={`h-5 w-5 ${
                                        evalData?.status === 'COMPLETE' ? 'text-emerald-600' :
                                        evalData?.status === 'PARTIAL' ? 'text-amber-600' :
                                        'text-gray-400'
                                    }`} />
                                </div>
                            </CardHeader>
                            
                            <CardContent className="space-y-4">
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-4xl font-bold ${getScoreColor(evalData?.score ?? null)}`}>
                                        {evalData?.score != null ? Math.round(evalData.score) : '–'}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        / 100
                                    </span>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-muted-foreground">Progress</span>
                                        <span className="text-xs font-medium">
                                            {evalData?.scored_components || 0} / {evalData?.total_components || 0} components
                                        </span>
                                    </div>
                                    <Progress value={progressPercent} className="h-2" />
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    {statusConfig.badge}
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
