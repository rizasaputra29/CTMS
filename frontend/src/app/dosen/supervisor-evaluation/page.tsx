'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileCheck, AlertCircle, Clock, GraduationCap, Calendar, MapPin, Users, Eye, Play, Edit, User } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

interface GroupMember {
  id: number;
  name: string;
  nim: string;
  is_leader: boolean;
}

interface Evaluation {
  schedule_id: number | null;
  schedule_type: string;
  date: string | null;
  room: string | null;
  deadline: string | null;
  status: 'pending' | 'partial' | 'completed' | 'not_configured';
}

interface Group {
  id: number;
  name: string;
  code: string;
  period: {
    id: number;
    name: string;
  };
  supervisor_role: 'SUPERVISOR_1' | 'SUPERVISOR_2';
  members: GroupMember[];
  evaluations: Record<string, Evaluation>;
}

interface Schedule {
  schedule_id: number | null;
  schedule_type: string;
  evaluation_type: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  deadline: string | null;
  group: {
    id: number;
    name: string;
    code: string;
  };
  students: GroupMember[];
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'NOT_CONFIGURED';
  supervisor_role: 'SUPERVISOR_1' | 'SUPERVISOR_2';
  period: {
    id: number;
    name: string;
  };
}

interface Period {
  id: number;
  name: string;
}

const getEvaluationTypeColor = (type: string) => {
  switch (type) {
    case 'BIMBINGAN_SEMPRO':
      return 'bg-blue-100 text-blue-800';
    case 'NILAI_DOSEN':
      return 'bg-purple-100 text-purple-800';
    case 'MILESTONE':
      return 'bg-orange-100 text-orange-800';
    case 'EXPO':
      return 'bg-emerald-100 text-emerald-800';
    case 'BIMBINGAN_TA':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'COMPLETED':
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <FileCheck className="w-3 h-3 mr-1" />
          Sudah Dinilai
        </Badge>
      );
    case 'PARTIAL':
    case 'partial':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          Sebagian
        </Badge>
      );
    case 'PENDING':
    case 'pending':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <AlertCircle className="w-3 h-3 mr-1" />
          Belum Dinilai
        </Badge>
      );
    case 'NOT_CONFIGURED':
    case 'not_configured':
      return (
        <Badge variant="secondary">
          Belum Dikonfigurasi
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getEvaluationTypeLabel = (type: string) => {
  switch (type) {
    case 'BIMBINGAN_SEMPRO':
      return 'BIMBINGAN_SEMPRO';
    case 'NILAI_DOSEN':
      return 'NILAI_DOSEN';
    case 'MILESTONE':
      return 'MILESTONE';
    case 'EXPO':
      return 'EXPO';
    case 'BIMBINGAN_TA':
      return 'BIMBINGAN_TA';
    default:
      return type;
  }
};

export default function SupervisorEvaluationPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'schedule' | 'group'>('schedule');
  const [groups, setGroups] = useState<Group[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchPeriods = useCallback(async () => {
    try {
      const response = await api.get('/periods-list');
      setPeriods(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching periods:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (viewMode === 'schedule') {
        const params = selectedPeriod !== 'all' ? { period_id: selectedPeriod } : {};
        const response = await api.get('/dosen/supervisor-evaluation/schedules', { params });
        setSchedules(response.data.data || []);
      } else {
        const response = await api.get('/dosen/supervisor-evaluation/groups');
        setGroups(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedPeriod]);

  useEffect(() => {
    fetchPeriods();
    fetchData();
  }, [fetchData, fetchPeriods]);

  const filteredSchedules = schedules.filter((schedule) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return schedule.status === 'PENDING' || schedule.status === 'PARTIAL';
    if (filter === 'completed') return schedule.status === 'COMPLETED';
    return true;
  }).filter((schedule) => {
    if (selectedType === 'all') return true;
    return schedule.evaluation_type === selectedType;
  });

  const filteredGroups = groups.filter((group) => {
    if (filter === 'all') return true;
    if (filter === 'pending') {
      return Object.values(group.evaluations).some((e) => e.status === 'pending' || e.status === 'partial');
    }
    if (filter === 'completed') {
      return Object.values(group.evaluations).every((e) => e.status === 'completed');
    }
    return true;
  });

  const todaySchedules = filteredSchedules.filter((s) => s.date && isToday(parseISO(s.date)));
  const upcomingSchedules = filteredSchedules.filter((s) => s.date && isFuture(parseISO(s.date)) && !isToday(parseISO(s.date)));
  const pastSchedules = filteredSchedules.filter((s) => s.date && isPast(parseISO(s.date)) && !isToday(parseISO(s.date)));
  const unscheduledEvaluations = filteredSchedules.filter((s) => !s.date);

  const handleEvaluate = (groupId: number, type: string) => {
    router.push(`/dosen/supervisor-evaluation/${groupId}?type=${type}`);
  };

  const handleEvaluateFromSchedule = (schedule: Schedule) => {
    router.push(`/dosen/supervisor-evaluation/${schedule.group.id}?type=${schedule.evaluation_type}`);
  };

  const isDeadlineUrgent = (deadline: string | null) => {
    if (!deadline) return false;
    const deadlineDate = parseISO(deadline);
    const now = new Date();
    const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours <= 24 && diffHours > 0;
  };

  const isDeadlineOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return isPast(parseISO(deadline));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <GraduationCap className="w-8 h-8" />
          Penilaian Mahasiswa Bimbingan
        </h1>
        <p className="text-muted-foreground mt-2">
          Nilai mahasiswa bimbingan Anda berdasarkan jadwal atau grup
        </p>
      </div>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'schedule' | 'group')} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="schedule">
            <Calendar className="w-4 h-4 mr-2" />
            Berdasarkan Jadwal
          </TabsTrigger>
          <TabsTrigger value="group">
            <Users className="w-4 h-4 mr-2" />
            Berdasarkan Grup
          </TabsTrigger>
        </TabsList>

        {/* Schedule View */}
        <TabsContent value="schedule" className="mt-6">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Filter Status</label>
                  <Tabs value={filter} onValueChange={setFilter}>
                    <TabsList>
                      <TabsTrigger value="all">Semua</TabsTrigger>
                      <TabsTrigger value="pending">
                        Menunggu ({filteredSchedules.filter(s => s.status === 'PENDING' || s.status === 'PARTIAL').length})
                      </TabsTrigger>
                      <TabsTrigger value="completed">
                        Selesai ({filteredSchedules.filter(s => s.status === 'COMPLETED').length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Periode</label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Periode</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Tipe Penilaian</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Tipe</SelectItem>
                      <SelectItem value="BIMBINGAN_SEMPRO">BIMBINGAN_SEMPRO</SelectItem>
                      <SelectItem value="NILAI_DOSEN">NILAI_DOSEN</SelectItem>
                      <SelectItem value="MILESTONE">MILESTONE</SelectItem>
                      <SelectItem value="EXPO">EXPO</SelectItem>
                      <SelectItem value="BIMBINGAN_TA">BIMBINGAN_TA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Sections */}
          {filteredSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Tidak ada jadwal yang sesuai dengan filter
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* Today Section */}
              {todaySchedules.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
                    Hari Ini ({todaySchedules.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {todaySchedules.map((schedule) => (
                      <ScheduleCard
                        key={`${schedule.schedule_id}-${schedule.evaluation_type}`}
                        schedule={schedule}
                        onEvaluate={() => handleEvaluateFromSchedule(schedule)}
                        isUrgent={isDeadlineUrgent(schedule.deadline)}
                        isOverdue={isDeadlineOverdue(schedule.deadline)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Section */}
              {upcomingSchedules.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-yellow-600">
                    Mendatang ({upcomingSchedules.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {upcomingSchedules.map((schedule) => (
                      <ScheduleCard
                        key={`${schedule.schedule_id}-${schedule.evaluation_type}`}
                        schedule={schedule}
                        onEvaluate={() => handleEvaluateFromSchedule(schedule)}
                        isUrgent={isDeadlineUrgent(schedule.deadline)}
                        isOverdue={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Section */}
              {pastSchedules.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-500">
                    Sudah Lewat ({pastSchedules.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pastSchedules.map((schedule) => (
                      <ScheduleCard
                        key={`${schedule.schedule_id}-${schedule.evaluation_type}`}
                        schedule={schedule}
                        onEvaluate={() => handleEvaluateFromSchedule(schedule)}
                        isUrgent={false}
                        isOverdue={isDeadlineOverdue(schedule.deadline) && schedule.status !== 'COMPLETED'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No Schedule Section (status-based evaluations) */}
              {unscheduledEvaluations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-slate-600">
                    Tanpa Jadwal ({unscheduledEvaluations.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {unscheduledEvaluations.map((schedule) => (
                      <ScheduleCard
                        key={`${schedule.group.id}-${schedule.evaluation_type}`}
                        schedule={schedule}
                        onEvaluate={() => handleEvaluateFromSchedule(schedule)}
                        isUrgent={false}
                        isOverdue={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Group View */}
        <TabsContent value="group" className="mt-6">
          <Tabs defaultValue="all" className="mb-6" onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">
                Semua ({groups.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Menunggu
              </TabsTrigger>
              <TabsTrigger value="completed">
                Selesai
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {filter === 'all'
                    ? 'Tidak ada kelompok bimbingan yang memerlukan penilaian'
                    : 'Tidak ada kelompok yang sesuai dengan filter'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredGroups.map((group) => (
                <Card key={group.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Group {group.id}</CardTitle>
                      </div>
                      <Badge variant="outline">
                        {group.supervisor_role === 'SUPERVISOR_1'
                          ? 'Dosbing 1'
                          : 'Dosbing 2'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {group.period.name}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Anggota Kelompok:</p>
                      <div className="space-y-1">
                        {group.members.map((member) => (
                          <div
                            key={member.id}
                            className="text-sm text-muted-foreground flex items-center gap-2"
                          >
                            <span>{member.name}</span>
                            {member.is_leader && (
                              <Badge variant="secondary" className="text-xs">
                                Ketua
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 flex-1">
                      <p className="text-sm font-medium">Penilaian:</p>
                      {Object.entries(group.evaluations).map(([type, evaluation]) => (
                        <div
                          key={type}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">
                              {getEvaluationTypeLabel(type)}
                            </span>
                            {getStatusBadge(evaluation.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>Jadwal: {evaluation.date ? new Date(evaluation.date).toLocaleDateString('id-ID') : '-'}</p>
                            <p>Ruangan: {evaluation.room || '-'}</p>
                            {evaluation.deadline && (
                              <p>
                                Deadline:{' '}
                                {new Date(evaluation.deadline).toLocaleDateString('id-ID')}
                              </p>
                            )}
                          </div>
                          {evaluation.status !== 'completed' && evaluation.status !== 'not_configured' && (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleEvaluate(group.id, type)}
                            >
                              {evaluation.status === 'partial' ? 'Lanjutkan' : 'Nilai Sekarang'}
                            </Button>
                          )}
                          {evaluation.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handleEvaluate(group.id, type)}
                            >
                              Lihat Nilai
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ScheduleCardProps {
  schedule: Schedule;
  onEvaluate: () => void;
  isUrgent: boolean;
  isOverdue: boolean;
}

function ScheduleCard({ schedule, onEvaluate, isUrgent, isOverdue }: ScheduleCardProps) {
  const getButtonText = () => {
    if (schedule.status === 'COMPLETED') return 'Lihat Nilai';
    if (schedule.status === 'PARTIAL') return 'Lanjutkan Nilai';
    return 'Nilai Sekarang';
  };

  const getButtonIcon = () => {
    if (schedule.status === 'COMPLETED') return <Eye className="w-4 h-4 mr-2" />;
    if (schedule.status === 'PARTIAL') return <Edit className="w-4 h-4 mr-2" />;
    return <Play className="w-4 h-4 mr-2" />;
  };

  return (
    <Card className={`transition-all hover:shadow-md ${
      isOverdue && schedule.status !== 'COMPLETED' ? 'border-red-500 bg-red-50' : ''
    } ${schedule.status === 'COMPLETED' ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <Badge className={getEvaluationTypeColor(schedule.evaluation_type)}>
            {schedule.evaluation_type}
          </Badge>
          {getStatusBadge(schedule.status)}
        </div>
        <CardTitle className="text-lg mt-2">Group {schedule.group.id}</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Schedule Info */}
        {schedule.date ? (
          <>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              {format(parseISO(schedule.date), 'EEEE, dd MMMM yyyy', { locale: id })}
            </div>

            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-2 h-4 w-4" />
              {schedule.start_time || '-'} - {schedule.end_time || '-'}
            </div>

            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="mr-2 h-4 w-4" />
              {schedule.room || '-'}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Evaluasi ini berbasis status grup dan belum memiliki jadwal khusus.
          </div>
        )}

        {/* Deadline */}
        {schedule.deadline && (
          <div className={`flex items-center text-sm ${
            isOverdue ? 'text-red-600 font-medium' : 
            isUrgent ? 'text-yellow-600 font-medium' : 'text-muted-foreground'
          }`}>
            <AlertCircle className="mr-2 h-4 w-4" />
            Deadline: {format(parseISO(schedule.deadline), 'dd MMMM yyyy HH:mm', { locale: id })}
            {isOverdue && ' (Terlewat)'}
          </div>
        )}

        {/* Students */}
        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-2">Mahasiswa:</p>
          <div className="flex flex-wrap gap-1">
            {schedule.students.map((student) => (
              <Badge key={student.id} variant="secondary" className="text-xs">
                {student.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Supervisor Role */}
        <div className="flex items-center text-sm text-muted-foreground">
          <User className="mr-2 h-4 w-4" />
          {schedule.supervisor_role === 'SUPERVISOR_1' ? 'Dosbing 1' : 'Dosbing 2'}
        </div>
      </CardContent>

      <CardFooter>
        <Button 
          className="w-full"
          variant={schedule.status === 'COMPLETED' ? 'outline' : 'default'}
          onClick={onEvaluate}
        >
          {getButtonIcon()}
          {getButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
}
