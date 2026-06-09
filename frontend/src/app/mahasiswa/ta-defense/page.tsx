'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, GraduationCap, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';

interface TaDefenseSchedule {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
    evaluation_deadline: string;
    notes: string | null;
    examiner1: { id: number; name: string };
    examiner2: { id: number; name: string };
}

interface TaStatus {
    ta_status: 'TA_BLOCKED' | 'TA_ACTIVE' | 'TA_DONE';
    has_completed_peer_review: boolean;
    can_access_ta: boolean;
}

export default function MahasiswaTaDefensePage() {
    const [schedule, setSchedule] = useState<TaDefenseSchedule | null>(null);
    const [taStatus, setTaStatus] = useState<TaStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [scheduleRes, statusRes] = await Promise.all([
                    api.get('/mahasiswa/ta-defense-schedules/my-schedule'),
                    api.get('/mahasiswa/ta-status')
                ]);

                // API returns an array, take the first (most recent) schedule
                const schedules = scheduleRes.data.data;
                setSchedule(Array.isArray(schedules) && schedules.length > 0 ? schedules[0] : null);
                setTaStatus(statusRes.data.data);
            } catch (error: unknown) {
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                if (status !== 404) {
                    toast.error('Failed to load TA defense information');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SCHEDULED':
                return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
            case 'DONE':
                return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
            case 'CANCELLED':
                return <Badge variant="secondary">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getTAStatusBadge = (status: string) => {
        switch (status) {
            case 'TA_BLOCKED':
                return <Badge className="bg-red-100 text-red-800">TA Blocked</Badge>;
            case 'TA_ACTIVE':
                return <Badge className="bg-blue-100 text-blue-800">TA Active</Badge>;
            case 'TA_DONE':
                return <Badge className="bg-green-100 text-green-800">TA Completed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) return <Loading variant="section" />;

    // If TA is blocked, show blocking message
    if (taStatus?.ta_status === 'TA_BLOCKED') {
        return (
            <div className="container mx-auto py-6 max-w-4xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">TA Defense</h1>
                    <p className="text-muted-foreground mt-1">
                        Thesis defense schedule and information
                    </p>
                </div>

                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                        <p className="font-medium">TA Phase Blocked</p>
                        <p>You must complete peer review before accessing TA defense phase.</p>
                        <Button variant="outline" size="sm" className="mt-2" asChild>
                            <Link href="/mahasiswa/peer-review">
                                Go to Peer Review
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>

                <Card className="opacity-60">
                    <CardContent className="py-12 text-center">
                        <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Complete peer review to unlock TA defense</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // If no schedule yet
    if (!schedule) {
        return (
            <div className="container mx-auto py-6 max-w-4xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">TA Defense</h1>
                    <p className="text-muted-foreground mt-1">
                        Thesis defense schedule and information
                    </p>
                </div>

                <Card>
                    <CardContent className="py-12 text-center">
                        <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Schedule Yet</h3>
                        <p className="text-muted-foreground max-w-md mx-auto mb-4">
                            Your TA defense has not been scheduled. Please contact your supervisor or admin.
                        </p>
                        <div className="flex justify-center gap-2">
                            {getTAStatusBadge(taStatus?.ta_status || 'TA_ACTIVE')}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isDeadlinePassed = new Date(schedule.evaluation_deadline) < new Date();
    const isCompleted = schedule.status === 'DONE';

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">TA Defense</h1>
                        <p className="text-muted-foreground mt-1">
                            Thesis defense schedule and information
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {getTAStatusBadge(taStatus?.ta_status || 'TA_ACTIVE')}
                        {getStatusBadge(schedule.status)}
                    </div>
                </div>
            </div>

            {/* Schedule Card */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Defense Schedule</CardTitle>
                    <CardDescription>
                        Your individual thesis defense schedule
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center text-sm">
                            <Calendar className="mr-3 h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Date</p>
                                <p className="text-muted-foreground">
                                    {new Date(schedule.date).toLocaleDateString('id-ID', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center text-sm">
                            <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Time</p>
                                <p className="text-muted-foreground">
                                    {schedule.start_time} - {schedule.end_time}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center text-sm">
                            <MapPin className="mr-3 h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Location</p>
                                <p className="text-muted-foreground">
                                    {schedule.room || 'Will be announced'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center text-sm">
                            <Users className="mr-3 h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Examiners</p>
                                <p className="text-muted-foreground">
                                    1. {schedule.examiner1?.name || 'TBA'}
                                </p>
                                <p className="text-muted-foreground">
                                    2. {schedule.examiner2?.name || 'TBA'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm">
                                <FileText className="mr-3 h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Evaluation Deadline</p>
                                    <p className={`${isDeadlinePassed && !isCompleted ? 'text-red-600' : 'text-muted-foreground'}`}>
                                        {new Date(schedule.evaluation_deadline).toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                        {isDeadlinePassed && !isCompleted && ' (Overdue)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {schedule.notes && (
                        <div className="pt-4 border-t">
                            <p className="font-medium text-sm mb-2">Notes</p>
                            <p className="text-sm text-muted-foreground">{schedule.notes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Status Messages */}
            {isCompleted ? (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                        Your TA defense has been completed. Congratulations!
                    </AlertDescription>
                </Alert>
            ) : schedule.status === 'CANCELLED' ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Your TA defense schedule has been cancelled. Please contact admin for rescheduling.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Please prepare your thesis defense presentation and arrive 15 minutes early.
                        Bring all necessary documents and materials.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
