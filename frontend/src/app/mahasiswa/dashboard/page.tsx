'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ArrowRight, Calendar, CheckCircle, BookOpen,
    Clock, Upload, Check, Lock, GraduationCap, Zap,
    AlertCircle, FileText, Circle, ChevronUp, ChevronDown,
    AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { 
    SupervisorInEvaluation, 
    EvaluationWithSupervisors,
    LatestDocument,
    NextPhaseSeminarSchedule
} from '@/types';

interface Schedule {
    id: string | number;
    type: 'BIMBINGAN' | 'SEMPRO' | 'EXPO' | 'TA_DEFENSE';
    date: string;
    room: string;
    mode: 'ONLINE' | 'OFFLINE' | null;
    notes: string | null;
    time_until: string;
}

interface WorkflowPhase {
    phase: string;
    status: 'locked' | 'unlocked' | 'submitted' | 'draft' | 'revision' | 'completed';
    documents: Array<{
        type: string;
        status: 'missing' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
        latest_document?: LatestDocument | null;
    }>;
    required_types: string[];
    document_count: number;
}

interface WorkflowData {
    phases: WorkflowPhase[];
    current_phase: string | null;
    is_graduated: boolean;
}

interface NextPhaseRequirements {
    current_phase: string;
    next_phase: string;
    documents: {
        completed: boolean;
        total_required: number;
        approved_count: number;
        pending_types: string[];
    };
    supervisor_evaluation?: EvaluationWithSupervisors | null;
    supervisor_evaluations?: EvaluationWithSupervisors[];
    seminar_schedule?: NextPhaseSeminarSchedule;
}

interface FinalReadyStatus {
    ready: boolean;
    expo_documents: {
        completed: boolean;
        pending_types: string[];
        total_required: number;
        approved_count: number;
    };
    nilai_dosen: {
        required: boolean;
        configured: boolean;
        completed: boolean;
        component_count: number;
        supervisors: Array<{
            id: number;
            name: string;
            status: string;
            submitted_components: number;
            total_components: number;
        }>;
    };
    milestone: {
        required: boolean;
        configured: boolean;
        completed: boolean;
        component_count: number;
        supervisors: SupervisorInEvaluation[];
    };
    expo_evaluation: {
        required: boolean;
        configured: boolean;
        completed: boolean;
        component_count: number;
        supervisors: SupervisorInEvaluation[];
    };
    peer_review: {
        required: boolean;
        configured: boolean;
        completed: boolean;
        indicator_count: number;
        total_members: number;
        completed_members: number;
    };
}

interface MahasiswaStats {
    has_group: boolean;
    group_status: string | null;
    title: string | null;
    group_period: { name: string } | null;
    active_periods: { id: number; name: string }[];
    steps: Record<string, boolean>;
    is_graduated: boolean;
    upcoming_schedules?: Schedule[];
    workflow?: WorkflowData;
    next_phase_requirements?: NextPhaseRequirements | null;
    final_ready_for_ta_individual?: FinalReadyStatus;
}

const WORKFLOW_STEPS = [
    { key: 'BIDDING', label: 'Select Title' },
    { key: 'APPROVAL', label: 'Approval' },
    { key: 'PDC1', label: 'PDC 1' },
    { key: 'SEMPRO', label: 'Sempro' },
    { key: 'PDC2', label: 'PDC 2' },
    { key: 'EXPO', label: 'Expo' },
    { key: 'SIDANG', label: 'Sidang' },
];

const getScheduleTypeColor = (type: string) => {
    switch (type) {
        case 'BIMBINGAN':
            return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
        case 'SEMPRO':
            return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
        case 'EXPO':
            return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
        case 'TA_DEFENSE':
            return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
    }
};

const getScheduleTypeLabel = (type: string) => {
    switch (type) {
        case 'BIMBINGAN':
            return 'Bimbingan';
        case 'SEMPRO':
            return 'Sempro';
        case 'EXPO':
            return 'Expo';
        case 'TA_DEFENSE':
            return 'TA Defense';
        default:
            return type;
    }
};

const PHASE_LABELS: Record<string, string> = {
    'PDC1': 'PDC 1',
    'SEMPRO': 'Seminar Proposal',
    'PDC2': 'PDC 2',
    'TA_DRAFT': 'TA Draft (Group)',
    'EXPO': 'Expo',
    'TA_INDIVIDUAL_READY': 'Ready for TA Individual',
};

const getPhaseStatusColor = (status: string) => {
    switch (status) {
        case 'completed':
            return 'border-green-500 bg-green-500 text-white';
        case 'submitted':
            return 'border-blue-500 bg-blue-500 text-white';
        case 'revision':
            return 'border-yellow-500 bg-yellow-500 text-white';
        case 'locked':
            return 'border-muted-foreground/30 bg-muted text-muted-foreground';
        case 'draft':
            return 'border-orange-400 bg-orange-400 text-white';
        default:
            return 'border-primary bg-background text-primary';
    }
};

const getPhaseStatusIcon = (status: string) => {
    switch (status) {
        case 'completed':
            return <Check className="h-5 w-5" />;
        case 'submitted':
            return <Clock className="h-5 w-5" />;
        case 'revision':
            return <AlertTriangle className="h-5 w-5" />;
        case 'locked':
            return <Lock className="h-4 w-4" />;
        case 'draft':
            return <FileText className="h-5 w-5" />;
        default:
            return <Circle className="h-5 w-5" />;
    }
};

export default function MahasiswaDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<MahasiswaStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [showRequirements, setShowRequirements] = useState(false);

    useEffect(() => {
        const checkRegistration = async () => {
            try {
                const response = await api.get('/mahasiswa/my-period');
                const hasRegistration = !!response.data?.period;

                // Redirect to registration if not registered
                if (!hasRegistration) {
                    window.location.href = '/mahasiswa/registration';
                    return;
                }

                // Show notification if auto-registered
                if (response.data?.auto_registered) {
                    toast.success(response.data?.message || 'You have been automatically registered based on your group membership.');
                }

                // Fetch dashboard stats only if registered
                const statsResponse = await api.get('/mahasiswa/dashboard');
                setStats(statsResponse.data);
            } catch (error) {
                console.error('Failed to check registration', error);
                // Only redirect to registration on 404 (endpoint not found) or successful response with no period
                // For other errors (500, network error), show error instead
                if (api.isAxiosError(error) && error.response?.status === 404) {
                    // Endpoint not found, assume not registered
                    window.location.href = '/mahasiswa/registration';
                } else if (api.isAxiosError(error) && error.response?.status === 200) {
                    // Success response but no period data
                    window.location.href = '/mahasiswa/registration';
                } else {
                    // Other errors - show error message instead of redirecting
                    setLoading(false);
                    toast.error('Failed to load registration data. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };
        checkRegistration();
    }, []);

    // Lazy load workflow data when user has group and it's approved
    useEffect(() => {
        const groupApproved = stats?.group_status && ![
            'FORMING', 'FORMING_SOLO', 'READY_FOR_BIDDING', 'REJECTED'
        ].includes(stats.group_status);
        
        if (stats?.has_group && groupApproved) {
            loadWorkflowData();
        }
    }, [stats?.has_group, stats?.group_status]);

    const loadWorkflowData = async () => {
        setWorkflowLoading(true);
        try {
            const response = await api.get('/mahasiswa/dashboard/workflow');
            setStats(prev => prev ? { ...prev, ...response.data } : null);
        } catch (error) {
            console.error('Failed to load workflow data', error);
        } finally {
            setWorkflowLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    if (!stats) {
        return <div className="p-4">Failed to load dashboard data.</div>;
    }

    const isGroupApproved = stats.group_status && ![
        'FORMING',
        'FORMING_SOLO',
        'READY_FOR_BIDDING',
        'REJECTED'
    ].includes(stats.group_status);

    const isSoloSeeker = stats.group_status && ['FORMING_SOLO', 'FORMING'].includes(stats.group_status);

    const getStepStatus = (stepKey: string): 'completed' | 'current' | 'error' | 'upcoming' => {
        if (stepKey === 'BIDDING') {
            return stats.has_group ? 'completed' : 'current';
        }
        if (stepKey === 'APPROVAL') {
            if (!stats.has_group) return 'upcoming';
            if (isGroupApproved) return 'completed';
            if (stats.group_status === 'REJECTED') return 'error';
            return 'current';
        }
        if (!isGroupApproved) return 'upcoming';
        if (stats.steps[stepKey]) return 'completed';

        const docPhases = ['PDC1', 'SEMPRO', 'PDC2', 'EXPO', 'TA', 'SIDANG'];
        for (const phase of docPhases) {
            if (!stats.steps[phase]) {
                return stepKey === phase ? 'current' : 'upcoming';
            }
        }
        return 'upcoming';
    };

    const currentPhase = WORKFLOW_STEPS.find(step => getStepStatus(step.key) === 'current');
    const completedCount = Object.values(stats.steps).filter(Boolean).length + (stats.has_group ? 1 : 0) + (isGroupApproved ? 1 : 0);
    const totalSteps = WORKFLOW_STEPS.length;
    const progressPercent = Math.round((completedCount / totalSteps) * 100);

    return (
        <div className="flex flex-col space-y-6">

            <div className="flex flex-col">
                <div className="text-2xl font-bold tracking-tight">
                    Welcome back, {user?.name || 'Student'}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Periode: <strong>{stats.group_period?.name || (stats.active_periods?.length > 0 ? stats.active_periods[0].name : 'N/A')}</strong></span>
                </div>
            </div>

            {/* Workflow Stepper - Matches Documents Page Style */}
            {stats?.workflow?.phases && stats.workflow.phases.length > 0 && (
                <div className="space-y-4">
                    {stats.workflow.is_graduated && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                            <h2 className="text-xl font-bold text-green-600">🎓 Congratulations! All phases completed.</h2>
                        </div>
                    )}

                    {/* Horizontal stepper */}
                    <div className="relative">
                        {(() => {
                            const stepCount = stats.workflow!.phases.length + (stats.final_ready_for_ta_individual ? 1 : 0);
                            return stepCount > 1 && (
                                <div
                                    className="hidden md:block absolute top-6 h-0.5 bg-muted z-0"
                                    style={{
                                        left: `${50 / stepCount}%`,
                                        right: `${50 / stepCount}%`,
                                    }}
                                />
                            );
                        })()}
                        <div
                            className={cn(
                                'grid grid-cols-1 gap-4 relative z-10',
                                (() => {
                                    const stepCount = stats.workflow!.phases.length + (stats.final_ready_for_ta_individual ? 1 : 0);
                                    const gridCols: Record<number, string> = {
                                        1: 'md:grid-cols-1',
                                        2: 'md:grid-cols-2',
                                        3: 'md:grid-cols-3',
                                        4: 'md:grid-cols-4',
                                        5: 'md:grid-cols-5',
                                        6: 'md:grid-cols-6',
                                    };
                                    return gridCols[stepCount] || 'md:grid-cols-6';
                                })()
                            )}
                        >
                            {stats.workflow.phases.map((phaseInfo) => (
                                <div key={phaseInfo.phase} className="flex flex-col items-center text-center">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all mb-2",
                                        getPhaseStatusColor(phaseInfo.status),
                                        phaseInfo.status === 'unlocked' && "ring-4 ring-primary/20"
                                    )}>
                                        {getPhaseStatusIcon(phaseInfo.status)}
                                    </div>
                                    <h3 className={cn(
                                        "font-medium text-sm",
                                        phaseInfo.status === 'locked' && "text-muted-foreground"
                                    )}>
                                        {PHASE_LABELS[phaseInfo.phase] || phaseInfo.phase}
                                    </h3>
                                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{phaseInfo.status}</p>
                                </div>
                            ))}
                            
                            {/* Final TA Individual Ready Step */}
                            {stats.final_ready_for_ta_individual && (
                                <div className="flex flex-col items-center text-center">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all mb-2",
                                        stats.final_ready_for_ta_individual.ready
                                            ? 'border-green-500 bg-green-500 text-white'
                                            : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                                    )}>
                                        {stats.final_ready_for_ta_individual.ready
                                            ? <Check className="h-5 w-5" />
                                            : <Lock className="h-5 w-5" />
                                        }
                                    </div>
                                    <h3 className={cn(
                                        "font-medium text-sm",
                                        !stats.final_ready_for_ta_individual.ready && "text-muted-foreground"
                                    )}>
                                        {PHASE_LABELS['TA_INDIVIDUAL_READY']}
                                    </h3>
                                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                                        {stats.final_ready_for_ta_individual.ready ? 'completed' : 'locked'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {workflowLoading && !stats?.workflow?.phases && (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">

                {/* Progress Overview — spans 2 columns */}
                <Card className="col-span-1 md:col-span-2 flex flex-row items-center justify-between">
                    <div className="flex flex-col justify-center p-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <GraduationCap className="h-4 w-4" />
                            <span>Overall Progress</span>
                        </div>
                        <div className="text-3xl font-bold tracking-tight">
                            {stats.group_period?.name || (stats.active_periods?.length > 0 ? stats.active_periods[0].name : 'No Active Period')}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <Badge variant={stats.is_graduated ? 'default' : 'secondary'}>
                                {stats.is_graduated ? '🎓 Graduated' : currentPhase?.label || 'In Progress'}
                            </Badge>
                            {stats.group_status === 'APPROVED' && (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Approved
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Circular Progress */}
                    <div className="h-32 w-32 relative flex items-center justify-center shrink-0 mr-4">
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-bold">{progressPercent}%</span>
                            <span className="text-[10px] text-muted-foreground uppercase">Complete</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { value: completedCount, fill: 'var(--primary)' },
                                        { value: totalSteps - completedCount, fill: 'var(--muted)' }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={45}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    cornerRadius={4}
                                >
                                    <Cell fill="var(--primary)" />
                                    <Cell fill="var(--muted)" opacity={1} />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card className="col-span-1 flex flex-col justify-between">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Zap className="h-4 w-4" /> Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pt-2">
                        {!stats.has_group ? (
                            <>
                                <Button size="sm" className="w-full justify-between shadow-sm text-black bg-white border border-gray-200 hover:bg-gray-200 h-8 px-2" asChild>
                                    <Link href="/mahasiswa/group">
                                        {isSoloSeeker ? "Cari Kelompok (Bursa Ide)" : "Buat atau Cari Kelompok"} <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button size="sm" className="w-full justify-between shadow-sm text-black bg-white border border-gray-200 hover:bg-gray-200 h-8 px-2" asChild>
                                    <Link href="/mahasiswa/titles">
                                        Browse Titles <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </>
                        ) : isGroupApproved ? (
                            <Button size="sm" className="w-full justify-between" variant="default" asChild>
                                <Link href="/mahasiswa/documents">
                                    Upload Docs <Upload className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : (
                            <Button size="sm" className="w-full" variant="secondary" disabled>
                                <Clock className="mr-2 h-4 w-4" /> Waiting Approval
                            </Button>
                        )}
                        <Button size="sm" className="w-full justify-start shadow-sm text-black bg-white border border-gray-200 hover:bg-gray-200 h-8 px-2" asChild>
                            <Link href="/mahasiswa/schedule">
                                <Calendar className="mr-2 h-4 w-4" /> View Schedule
                            </Link>
                        </Button>
                        <Button size="sm" className="w-full justify-start shadow-sm text-black bg-white border border-gray-200 hover:bg-gray-200 h-8 px-2" asChild>
                            <Link href="/mahasiswa/grades">
                                <GraduationCap className="mr-2 h-4 w-4" /> View Grades
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Project Details */}
                <Card className="col-span-1 flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <BookOpen className="h-4 w-4" /> Project Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Title</div>
                            <div className="font-medium text-sm line-clamp-2 leading-snug" title={stats.title || 'No Title Selected'}>
                                {stats.title || 'No Title Selected'}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Group Status</div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-sm font-medium",
                                    isGroupApproved ? "text-green-600" :
                                        stats.group_status === 'REJECTED' ? "text-red-600" : "text-muted-foreground"
                                )}>
                                    {stats.group_status || 'Not Joined'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Current Phase</div>
                            <div className="text-sm font-medium">
                                {currentPhase?.label || (stats.is_graduated ? 'Completed' : 'N/A')}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-dashed">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Registration Period</div>
                            <div className="text-xs font-medium text-primary">
                                {stats.group_period?.name || 'Not Registered'}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Schedules */}
                <Card className="col-span-1 flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Upcoming Schedules
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 flex-1">
                        {stats.upcoming_schedules && stats.upcoming_schedules.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {stats.upcoming_schedules.map((schedule, index) => (
                                    <div key={schedule.id} className={cn(
                                        "p-3 rounded-lg border",
                                        index === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-muted"
                                    )}>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <Badge 
                                                variant="outline" 
                                                className={cn("text-[10px] uppercase tracking-wider font-semibold", getScheduleTypeColor(schedule.type))}
                                            >
                                                {getScheduleTypeLabel(schedule.type)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {schedule.time_until}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium">
                                                {new Date(schedule.date).toLocaleDateString('id-ID', { 
                                                    weekday: 'short', 
                                                    year: 'numeric', 
                                                    month: 'short', 
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <span className="truncate">{schedule.room}</span>
                                                {schedule.mode && (
                                                    <span className="shrink-0">• {schedule.mode}</span>
                                                )}
                                            </div>
                                            
                                            {schedule.notes && (
                                                <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                                    {schedule.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                <Button size="sm" className="w-full justify-between mt-2" variant="outline" asChild>
                                    <Link href="/mahasiswa/schedule">
                                        View Full Schedule <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                                <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                                <div className="text-sm text-muted-foreground">No upcoming schedules</div>
                                <div className="text-xs text-muted-foreground/70 mt-1">Check back later for updates</div>
                                <Button size="sm" className="w-full justify-between mt-4" variant="outline" asChild>
                                    <Link href="/mahasiswa/schedule">
                                        View Schedule <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>

            {/* Next Phase Requirements - Collapsible */}
            {stats?.next_phase_requirements && (
                <Card>
                    <CardHeader 
                        className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setShowRequirements(!showRequirements)}
                    >
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" /> 
                                Next Phase Requirements: {PHASE_LABELS[stats.next_phase_requirements.next_phase] || stats.next_phase_requirements.next_phase}
                            </CardTitle>
                            {showRequirements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </CardHeader>
                    {showRequirements && (
                        <CardContent>
                            {workflowLoading ? (
                                <div className="flex justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Documents Status */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Documents</span>
                                            <Badge variant={stats.next_phase_requirements.documents.completed ? 'default' : 'secondary'}>
                                                {stats.next_phase_requirements.documents.approved_count}/{stats.next_phase_requirements.documents.total_required}
                                            </Badge>
                                        </div>
                                        {!stats.next_phase_requirements.documents.completed && (
                                            <div className="text-xs text-muted-foreground">
                                                Pending: {stats.next_phase_requirements.documents.pending_types.join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    {/* SEMPRO Specific Requirements */}
                                    {stats.next_phase_requirements.seminar_schedule && (
                                        <div className="space-y-2 border-t pt-3">
                                            {!stats.next_phase_requirements.seminar_schedule.exists ? (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                                                    <div className="font-medium">SEMPRO Not Scheduled</div>
                                                    <div className="text-yellow-700">Contact admin to schedule your SEMPRO</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span>
                                                            {new Date(stats.next_phase_requirements.seminar_schedule.date!).toLocaleDateString('id-ID', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Examiner Evaluations */}
                                                    {stats.next_phase_requirements.seminar_schedule.examiner_evaluations && (
                                                        <div className="space-y-1">
                                                            <div className="text-xs font-medium">Examiner Evaluations</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {stats.next_phase_requirements.seminar_schedule.examiner_evaluations.submitted}/
                                                                {stats.next_phase_requirements.seminar_schedule.examiner_evaluations.total} submitted
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Supervisor Bimbingan */}
                                                    {stats.next_phase_requirements.seminar_schedule.supervisor_bimbingan && (
                                                        <div className="space-y-1">
                                                            <div className="text-xs font-medium">Supervisor Bimbingan</div>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {stats.next_phase_requirements.seminar_schedule.supervisor_bimbingan.supervisors.map((sup: SupervisorInEvaluation) => (
                                                                    <Badge 
                                                                        key={sup.id} 
                                                                        variant={sup.status === 'completed' ? 'default' : 'outline'}
                                                                        className="text-xs"
                                                                    >
                                                                        {sup.name}: {sup.submitted_components}/{sup.total_components}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Supervisor Evaluations for PDC2 */}
                                    {stats.next_phase_requirements.supervisor_evaluations && stats.next_phase_requirements.supervisor_evaluations.length > 0 && (
                                        <div className="space-y-2 border-t pt-3">
                                            <div className="text-sm font-medium">Supervisor Evaluations</div>
                                            {stats.next_phase_requirements.supervisor_evaluations.map((evalStatus: EvaluationWithSupervisors) => (
                                                <div key={evalStatus.evaluation_type} className="space-y-1">
                                                    <div className="text-xs font-medium">{evalStatus.evaluation_type}</div>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {evalStatus.supervisors.map((sup: SupervisorInEvaluation) => (
                                                            <Badge 
                                                                key={sup.id} 
                                                                variant={sup.status === 'completed' ? 'default' : 'outline'}
                                                                className="text-xs"
                                                            >
                                                                {sup.name}: {sup.submitted_components}/{sup.total_components}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Final TA Readiness Gate */}
            {stats?.final_ready_for_ta_individual && (
                <Card className={cn(
                    stats.final_ready_for_ta_individual.ready && "border-green-500 bg-green-50 dark:bg-green-900/10"
                )}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            {stats.final_ready_for_ta_individual.ready ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                                <Lock className="h-4 w-4" />
                            )}
                            Ready for TA Individual
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {/* Expo Documents */}
                            <div className="flex items-center justify-between text-sm">
                                <span>Expo Documents</span>
                                {stats.final_ready_for_ta_individual.expo_documents.completed ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        {stats.final_ready_for_ta_individual.expo_documents.approved_count}/
                                        {stats.final_ready_for_ta_individual.expo_documents.total_required}
                                    </span>
                                )}
                            </div>

                            {/* Evaluations */}
                            {[
                                { key: 'nilai_dosen', label: 'Nilai Dosen' },
                                { key: 'milestone', label: 'Milestone' },
                                { key: 'expo_evaluation', label: 'Expo Evaluation' }
                            ].map(({ key, label }) => {
                                const sectionKey = key as keyof FinalReadyStatus;
                                if (!stats.final_ready_for_ta_individual) return null;
                                const status = stats.final_ready_for_ta_individual[sectionKey];
                                if (typeof status !== 'object' || status === null || !('configured' in status)) return null;
                                const section = status as { configured: boolean; completed: boolean; supervisors?: SupervisorInEvaluation[] };
                                if (!section?.configured) return null;
                                return (
                                    <div key={key} className="flex items-center justify-between text-sm">
                                        <span>{label}</span>
                                        {section.completed ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                {section.supervisors?.filter((s: SupervisorInEvaluation) => s.status === 'completed').length || 0}/
                                                {section.supervisors?.length || 0}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Peer Review */}
                            {stats.final_ready_for_ta_individual.peer_review.configured && (
                                <div className="flex items-center justify-between text-sm">
                                    <span>Peer Review</span>
                                    {stats.final_ready_for_ta_individual.peer_review.completed ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            {stats.final_ready_for_ta_individual.peer_review.completed_members}/
                                            {stats.final_ready_for_ta_individual.peer_review.total_members} members
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
