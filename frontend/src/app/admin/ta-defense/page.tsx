'use client';

import { useState, useEffect, useCallback } from 'react';
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
    examiner_1: Dosen;
    examiner_2: Dosen;
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
            const [periodsRes, dosensRes, groupsRes] = await Promise.all([
                api.get('/admin/periods'),
                api.get('/admin/dosens'),
                api.get('/admin/groups', { params: { status: 'PDC2_COMPLETED' } }),
            ]);

            setPeriods(periodsRes.data.data || []);
            setDosens(dosensRes.data || []);
            setGroups(groupsRes.data.data || []);

            // Set active period as default
            const activePeriod = periodsRes.data.data?.find((p: Period) => p.is_active);
            if (activePeriod && !selectedPeriod) {
                setSelectedPeriod(activePeriod.id.toString());
            }
        } catch (error) {
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
        } catch (error) {
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
        
        // Filter students who don't have a schedule yet
        const scheduledStudentIds = schedules.map(s => s.student.id);
        return group.members.filter(m => !scheduledStudentIds.includes(m.student.id));
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
        } catch (error: any) {
            const message = error.response?.data?.message || 'Failed to create schedule';
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
            await api.post(`/admin/ta-defense-schedules/${cancelSchedule.id}/cancel`);
            toast.success('Schedule cancelled successfully');
            setCancelOpen(false);
            setCancelSchedule(null);
            fetchSchedules();
        } catch (error) {
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
            s.group.name.toLowerCase().includes(query) ||
            s.group.code.toLowerCase().includes(query) ||
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
                <CardContent className="pt-6">
                    <div className="flex gap-4 items-center">
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

            {/* Schedules List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredSchedules.map(schedule => (
                    <Card key={schedule.id} className={schedule.status === 'CANCELLED' ? 'opacity-60' : ''}>
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
                                {schedule.group.name} ({schedule.group.code})
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
                                        1. {schedule.examiner_1?.name || 'Not assigned'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        2. {schedule.examiner_2?.name || 'Not assigned'}
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

            {filteredSchedules.length === 0 && (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No TA defense schedules found</p>
                    <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                        Create First Schedule
                    </Button>
                </div>
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
                                                {g.name} ({g.code})
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
                                {cancelSchedule.group.name} - {new Date(cancelSchedule.date).toLocaleDateString('id-ID')}
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
