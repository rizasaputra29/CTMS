'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ArrowRight, Calendar, CheckCircle, BookOpen,
    Clock, Upload, Check, XCircle, Lock, GraduationCap, Zap
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/context/AuthContext';

interface MahasiswaStats {
    has_group: boolean;
    group_status: string | null;
    title: string | null;
    group_period: { name: string } | null;
    active_periods: { id: number; name: string }[];
    steps: Record<string, boolean>;
    is_graduated: boolean;
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

export default function MahasiswaDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<MahasiswaStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/mahasiswa/dashboard');
                setStats(response.data);
            } catch (error) {
                console.error('Failed to fetch dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-4 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    if (!stats) {
        return <div className="p-4">Failed to load dashboard data.</div>;
    }

    const isGroupApproved = stats.group_status && ![
        'FORMING',
        'READY_FOR_BIDDING',
        'WAITING_SUPERVISOR_APPROVAL',
        'REJECTED'
    ].includes(stats.group_status);

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

            <div className="text-2xl font-bold tracking-tight">
                Welcome back, {user?.name || 'Student'}
            </div>

            {/* Workflow Stepper */}
            <div className="relative pt-2 shrink-0">
                <div className="hidden md:block absolute top-[28px] left-[calc(100%/14)] right-[calc(100%/14)] h-0.5 bg-zinc-200 dark:bg-zinc-800 z-0" />
                <div className="grid grid-cols-1 md:grid-cols-7 gap-y-6 gap-x-2 relative z-10">
                    {WORKFLOW_STEPS.map((step) => {
                        const status = getStepStatus(step.key);
                        return (
                            <div key={step.key} className="flex flex-col items-center text-center">
                                <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all mb-2",
                                    status === 'completed' && "border-green-500 bg-green-500 text-white",
                                    status === 'current' && "border-primary bg-background text-primary ring-4 ring-primary/20",
                                    status === 'error' && "border-destructive bg-destructive text-white",
                                    status === 'upcoming' && "border-muted-foreground/30 bg-muted text-muted-foreground"
                                )}>
                                    {status === 'completed' ? <Check className="h-5 w-5" /> :
                                        status === 'error' ? <XCircle className="h-5 w-5" /> :
                                            status === 'current' ? <Clock className="h-5 w-5" /> :
                                                <Lock className="h-4 w-4" />}
                                </div>
                                <h3 className={cn(
                                    "font-medium text-[10px] md:text-xs uppercase tracking-tight",
                                    status === 'upcoming' && "text-muted-foreground"
                                )}>{step.label}</h3>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

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
                            <Button size="sm" className="w-full justify-between shadow-sm text-black bg-white border border-gray-200 hover:bg-gray-200 h-8 px-2" asChild>
                                <Link href="/mahasiswa/titles">
                                    Browse Titles <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
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
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
