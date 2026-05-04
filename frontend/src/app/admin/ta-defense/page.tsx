'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, Users, Plus, Search, GraduationCap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Period { id: number; name: string; is_active: boolean; }
interface Dosen { id: number; name: string; email: string; }
interface Student { id: number; name: string; nim: string; }

interface TaDefenseSchedule {
    id: number;
    student: Student;
    group: { id: number; name: string; code: string };
    period: Period;
    date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
    examiner1: Dosen;
    examiner2: Dosen;
    evaluation_deadline: string;
    notes: string | null;
}

interface GroupItem {
    id: number;
    name: string;
    code: string;
    members: { student: Student; is_leader: boolean }[];
    supervisions: { supervisor_id: number; role: 'SUPERVISOR_1' | 'SUPERVISOR_2' }[];
}

interface EligibleStudentData {
    group: { id: number; name: string; code: string };
    student: Student;
    supervisors: { id: number; pivot?: { role: string } }[];
    submission?: { id: number };
}

export default function AdminTaDefensePage() {
    const [schedules, setSchedules] = useState<TaDefenseSchedule[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [dosens, setDosens] = useState<Dosen[]>([]);
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('');
    const [formEndTime, setFormEndTime] = useState('');
    const [formRoom, setFormRoom] = useState('');
    const [formExaminer1, setFormExaminer1] = useState('');
    const [formExaminer2, setFormExaminer2] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [examinerError, setExaminerError] = useState('');

    // Cancel dialog
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelSchedule, setCancelSchedule] = useState<TaDefenseSchedule | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [periodsRes, dosensRes, eligibleRes] = await Promise.all([
                api.get('/admin/periods'),
                api.get('/admin/users?role=dosen'),
                api.get('/admin/ta-defense-schedules/eligible-students', {
                    params: selectedPeriod ? { period_id: selectedPeriod } : {}
                }),
            ]);

            setPeriods(periodsRes.data.data || []);
            // UserController returns paginated data with 'data' key containing the users
            const dosensData = dosensRes.data?.data || dosensRes.data || [];
            setDosens(Array.isArray(dosensData) ? dosensData : dosensData.data || []);

            // Transform eligible students data into groups format
            const eligibleData = eligibleRes.data.data || [];
            const groupsMap = new Map();
            
            eligibleData.forEach((item: EligibleStudentData) => {
                const group = item.group;
                if (!groupsMap.has(group.id)) {
                    groupsMap.set(group.id, {
                        ...group,
                        members: [],
                        supervisions: item.supervisors?.map((s: { id: number; pivot?: { role: string } }) => ({
                            supervisor_id: s.id,
                            role: s.pivot?.role || 'SUPERVISOR_1'
                        })) || []
                    });
                }
                groupsMap.get(group.id).members.push({
                    student: item.student,
                    is_leader: false,
                    submission_id: item.submission?.id
                });
            });

            setGroups(Array.from(groupsMap.values()));

            // Set active period as default
            const activePeriod = periodsRes.data.data?.find((p: Period) => p.is_active);
            if (activePeriod && !selectedPeriod) {
                setSelectedPeriod(activePeriod.id.toString());
            }
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod]);

    const fetchSchedules = useCallback(async () => {
        if (!selectedPeriod) return;
        try {
            const res = await api.get('/admin/ta-defense-schedules', {
                params: { period_id: selectedPeriod }
            });
            setSchedules(res.data.data || []);
        } catch {
            toast.error('Failed to load schedules');
        }
    }, [selectedPeriod]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const getAvailableStudents = () => {
        const group = groups.find(g => g.id.toString() === selectedGroupId);
        if (!group) return [];
        
        // Filter students who don't have an ACTIVE schedule (SCHEDULED or DONE)
        // Cancelled students can be rescheduled
        const activeScheduledStudentIds = schedules
            .filter(s => s.status === 'SCHEDULED' || s.status === 'DONE')
            .map(s => s.student.id);
        return group.members.filter(m => !activeScheduledStudentIds.includes(m.student.id));
    };

    const getSupervisorIds = () => {
        const group = groups.find(g => g.id.toString() === selectedGroupId);
        if (!group) return [];
        return group.supervisions?.map(s => s.supervisor_id) || [];
    };

    const validateExaminers = () => {
        setExaminerError('');
        
        if (formExaminer1 === formExaminer2) {
            setExaminerError('Examiner 1 and Examiner 2 cannot be the same');
            return false;
        }

        const supervisorIds = getSupervisorIds();
        
        if (supervisorIds.includes(parseInt(formExaminer1))) {
            setExaminerError('Examiner 1 cannot be a supervisor of this group');
            return false;
        }

        if (supervisorIds.includes(parseInt(formExaminer2))) {
            setExaminerError('Examiner 2 cannot be a supervisor of this group');
            return false;
        }

        return true;
    };

    const handleCreate = async () => {
        if (!validateExaminers()) return;

        try {
            setSubmitting(true);
            await api.post('/admin/ta-defense-schedules', {
                student_id: parseInt(selectedStudentId),
                group_id: parseInt(selectedGroupId),
                period_id: parseInt(selectedPeriod),
                examiner_1_id: parseInt(formExaminer1),
                examiner_2_id: parseInt(formExaminer2),
                date: formDate,
                start_time: formStartTime,
                end_time: formEndTime,
                room: formRoom,
                notes: formNotes || null,
            });

            toast.success('TA Defense schedule created successfully');
            setCreateOpen(false);
            resetForm();
            fetchSchedules();
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to create schedule'
                : 'Failed to create schedule';
            toast.error(message);
            if (message.includes('supervisor')) {
                setExaminerError(message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelSchedule) return;
        
        try {
            await api.put(`/admin/ta-defense-schedules/${cancelSchedule.id}/cancel`);
            toast.success('Schedule cancelled successfully');
            setCancelOpen(false);
            setCancelSchedule(null);
            fetchSchedules();
        } catch {
            toast.error('Failed to cancel schedule');
        }
    };

    const resetForm = () => {
        setSelectedGroupId('');
        setSelectedStudentId('');
        setFormDate('');
        setFormStartTime('');
        setFormEndTime('');
        setFormRoom('');
        setFormExaminer1('');
        setFormExaminer2('');
        setFormNotes('');
        setExaminerError('');
    };

    const filteredSchedules = schedules.filter(s => {
        const query = searchQuery.toLowerCase();
        return (
            s.student.name.toLowerCase().includes(query) ||
            s.student.nim.toLowerCase().includes(query) ||
            s.group.id.toString().includes(query) ||
            s.room?.toLowerCase().includes(query)
        );
    });

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">TA Defense Schedules</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage individual TA defense schedules for students
                        </p>
                    </div>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Schedule TA Defense
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-4">
                    <div className="flex gap-12 items-center">
                        <div className="w-64">
                            <Label>Period</Label>
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select period" />
                                </SelectTrigger>
                                <SelectContent>
                                    {periods.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>
                                            {p.name} {p.is_active && '(Active)'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 max-w-md">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search student, group, or room..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Schedules List with Tabs */}
            {filteredSchedules.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No TA defense schedules found</p>
                    <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                        Create First Schedule
                    </Button>
                </div>
            ) : (
                <Tabs defaultValue="active" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="active">
                            Active Schedules ({filteredSchedules.filter(s => s.status !== 'CANCELLED').length})
                        </TabsTrigger>
                        <TabsTrigger value="cancelled">
                            Cancelled Schedules ({filteredSchedules.filter(s => s.status === 'CANCELLED').length})
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="active" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredSchedules
                                .filter(schedule => schedule.status !== 'CANCELLED')
                                .map(schedule => (
                                    <Card key={schedule.id}>
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                {getStatusBadge(schedule.status)}
                                                {schedule.status === 'SCHEDULED' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => {
                                                            setCancelSchedule(schedule);
                                                            setCancelOpen(true);
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                            </div>
                                            <CardTitle className="text-lg mt-2">{schedule.student.name}</CardTitle>
                                            <CardDescription>{schedule.student.nim}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Users className="mr-2 h-4 w-4" />
                                                Group {schedule.group.id}
                                            </div>
                                            
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                {new Date(schedule.date).toLocaleDateString('id-ID', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                            
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Clock className="mr-2 h-4 w-4" />
                                                {schedule.start_time} - {schedule.end_time}
                                            </div>
                                            
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <MapPin className="mr-2 h-4 w-4" />
                                                {schedule.room || 'Room not set'}
                                            </div>

                                            <div className="pt-3 border-t">
                                                <p className="text-sm font-medium mb-2">Examiners:</p>
                                                <div className="space-y-1">
                                                    <div className="text-sm text-muted-foreground">
                                                        1. {schedule.examiner1?.name || 'Not assigned'}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        2. {schedule.examiner2?.name || 'Not assigned'}
                                                    </div>
                                                </div>
                                            </div>

                                            {schedule.evaluation_deadline && (
                                                <div className="pt-2 border-t">
                                                    <p className="text-xs text-muted-foreground">
                                                        Evaluation deadline: {new Date(schedule.evaluation_deadline).toLocaleDateString('id-ID')}
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                        </div>
                        {filteredSchedules.filter(s => s.status !== 'CANCELLED').length === 0 && (
                            <div className="text-center py-12 border rounded-lg border-dashed">
                                <p className="text-muted-foreground">No active schedules</p>
                            </div>
                        )}
                    </TabsContent>
                    
                    <TabsContent value="cancelled" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredSchedules
                                .filter(schedule => schedule.status === 'CANCELLED')
                                .map(schedule => (
                                    <Card key={schedule.id} className="opacity-60">
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                {getStatusBadge(schedule.status)}
                                            </div>
                                            <CardTitle className="text-lg mt-2">{schedule.student.name}</CardTitle>
                                            <CardDescription>{schedule.student.nim}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Users className="mr-2 h-4 w-4" />
                                                Group {schedule.group.id}
                                            </div>
                                            
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                {new Date(schedule.date).toLocaleDateString('id-ID', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                            
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Clock className="mr-2 h-4 w-4" />
                                                {schedule.start_time} - {schedule.end_time}
                                            </div>
                                            
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <MapPin className="mr-2 h-4 w-4" />
                                                {schedule.room || 'Room not set'}
                                            </div>

                                            <div className="pt-3 border-t">
                                                <p className="text-sm font-medium mb-2">Examiners:</p>
                                                <div className="space-y-1">
                                                    <div className="text-sm text-muted-foreground">
                                                        1. {schedule.examiner1?.name || 'Not assigned'}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        2. {schedule.examiner2?.name || 'Not assigned'}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                        </div>
                        {filteredSchedules.filter(s => s.status === 'CANCELLED').length === 0 && (
                            <div className="text-center py-12 border rounded-lg border-dashed">
                                <p className="text-muted-foreground">No cancelled schedules</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Schedule TA Defense</DialogTitle>
                        <DialogDescription>
                            Create a new TA defense schedule for an individual student.
                            Examiners cannot be supervisors of the group.
                        </DialogDescription>
                    </DialogHeader>

                    {examinerError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{examinerError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Group</Label>
                                <Select value={selectedGroupId} onValueChange={(val) => {
                                    setSelectedGroupId(val);
                                    setSelectedStudentId('');
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map(g => (
                                            <SelectItem key={g.id} value={g.id.toString()}>
                                                Group {g.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Student</Label>
                                <Select 
                                    value={selectedStudentId} 
                                    onValueChange={setSelectedStudentId}
                                    disabled={!selectedGroupId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select student" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getAvailableStudents().map(m => (
                                            <SelectItem key={m.student.id} value={m.student.id.toString()}>
                                                {m.student.name} {m.is_leader && '(Leader)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Room</Label>
                                <Input
                                    placeholder="e.g., Room A, Lab 1"
                                    value={formRoom}
                                    onChange={(e) => setFormRoom(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input
                                    type="time"
                                    value={formStartTime}
                                    onChange={(e) => setFormStartTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input
                                    type="time"
                                    value={formEndTime}
                                    onChange={(e) => setFormEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Examiner 1</Label>
                                <Select value={formExaminer1} onValueChange={setFormExaminer1}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select examiner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Examiner 2</Label>
                                <Select value={formExaminer2} onValueChange={setFormExaminer2}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select examiner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dosens.map(d => (
                                            <SelectItem key={d.id} value={d.id.toString()}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Input
                                placeholder="Additional notes..."
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setCreateOpen(false);
                            resetForm();
                        }}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleCreate} 
                            disabled={submitting || !selectedStudentId || !formDate || !formStartTime || !formEndTime || !formExaminer1 || !formExaminer2}
                        >
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Dialog */}
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Schedule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this TA defense schedule?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {cancelSchedule && (
                        <div className="py-4">
                            <p className="font-medium">{cancelSchedule.student.name}</p>
                            <p className="text-sm text-muted-foreground">
                                Group {cancelSchedule.group.id} - {new Date(cancelSchedule.date).toLocaleDateString('id-ID')}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelOpen(false)}>
                            Keep Schedule
                        </Button>
                        <Button variant="destructive" onClick={handleCancel}>
                            Cancel Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
