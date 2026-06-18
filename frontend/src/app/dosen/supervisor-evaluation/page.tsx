'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileCheck, AlertCircle, Clock, GraduationCap, Calendar, MapPin, Users, Eye, Play, Edit, User, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { toViewMode } from '@/types/guards';
import { formatDate } from '@/lib/utils';

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
  students?: GroupMember[];
  student: GroupMember | null;
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

const EVALUATION_TYPE_LABELS: Record<string, string> = {
  BIMBINGAN_SEMPRO: 'Bimbingan Sempro',
  NILAI_DOSEN: 'Nilai Dosen',
  MILESTONE: 'Milestone',
  EXPO: 'Expo',
  BIMBINGAN_TA: 'Bimbingan Sidang TA',
};

const getEvaluationTypeColor = (type: string) => {
  switch (type) {
    case 'BIMBINGAN_SEMPRO':
      return 'bg-blue-100 text-blue-800';
    case 'NILAI_DOSEN':
      return 'bg-primary-100 text-primary-500';
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
  return EVALUATION_TYPE_LABELS[type] || type;
};

export default function SupervisorEvaluationPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'schedule' | 'group'>('schedule');
  const [groups, setGroups] = useState<Group[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collapse state for past and unscheduled sections
  const [pastExpanded, setPastExpanded] = useState(false);
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(false);

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
        const params: Record<string, string> = {};
        if (selectedPeriod !== 'all') params.period_id = selectedPeriod;
        if (selectedType !== 'all') params.type = selectedType;
        const response = await api.get('/dosen/supervisor-evaluation/schedules', { params });
        setSchedules(response.data?.data || []);
      } else {
        const params: Record<string, string> = {};
        if (selectedPeriod !== 'all') params.period_id = selectedPeriod;
        if (selectedType !== 'all') params.type = selectedType;
        const response = await api.get('/dosen/supervisor-evaluation/groups', { params });
        setGroups(response.data?.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedPeriod, selectedType]);

  useEffect(() => {
    fetchPeriods();
    fetchData();
  }, [fetchData, fetchPeriods]);

  const filteredSchedules = useMemo(() => {
    let result = schedules ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.group?.code?.toLowerCase().includes(q) || s.group?.name?.toLowerCase().includes(q)
      );
    }
    result = result.filter((schedule) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending') return schedule.status === 'PENDING' || schedule.status === 'PARTIAL';
      if (statusFilter === 'completed') return schedule.status === 'COMPLETED';
      return true;
    });
    return result;
  }, [schedules, statusFilter, searchQuery]);

  const filteredGroups = useMemo(() => {
    let result = groups ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) =>
        g.code?.toLowerCase().includes(q) || g.name?.toLowerCase().includes(q)
      );
    }
    result = result.filter((group) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending') {
        return Object.values(group.evaluations ?? {}).some((e) => e.status === 'pending' || e.status === 'partial');
      }
      if (statusFilter === 'completed') {
        return Object.values(group.evaluations ?? {}).every((e) => e.status === 'completed');
      }
      return true;
    });
    return result;
  }, [groups, statusFilter, searchQuery]);

  // Compute counts for status tabs (pre-search, pre-status filter for accuracy)
  const pendingCount = useMemo(() => {
    if (viewMode === 'schedule') {
      return (schedules ?? []).filter((s) => s.status === 'PENDING' || s.status === 'PARTIAL').length;
    }
    return (groups ?? []).filter((g) =>
      Object.values(g.evaluations ?? {}).some((e) => e.status === 'pending' || e.status === 'partial')
    ).length;
  }, [viewMode, schedules, groups]);

  const completedCount = useMemo(() => {
    if (viewMode === 'schedule') {
      return (schedules ?? []).filter((s) => s.status === 'COMPLETED').length;
    }
    return (groups ?? []).filter((g) =>
      Object.values(g.evaluations ?? {}).every((e) => e.status === 'completed')
    ).length;
  }, [viewMode, schedules, groups]);

  const totalCount = useMemo(() => {
    return viewMode === 'schedule' ? schedules.length : groups.length;
  }, [viewMode, schedules, groups]);

  const todaySchedules = (filteredSchedules ?? []).filter((s) => s.date && isToday(parseISO(s.date)));
  const upcomingSchedules = (filteredSchedules ?? []).filter((s) => s.date && isFuture(parseISO(s.date)) && !isToday(parseISO(s.date)));
  const pastSchedules = (filteredSchedules ?? []).filter((s) => s.date && isPast(parseISO(s.date)) && !isToday(parseISO(s.date)));
  const unscheduledEvaluations = (filteredSchedules ?? []).filter((s) => !s.date);

  const handleEvaluate = (groupId: number, type: string) => {
    router.push(`/dosen/supervisor-evaluation/${groupId}?type=${type}`);
  };

  const handleEvaluateFromSchedule = (schedule: Schedule) => {
    const studentParam = schedule.student ? `&student_id=${schedule.student.id}` : '';
    router.push(`/dosen/supervisor-evaluation/${schedule.group.id}?type=${schedule.evaluation_type}${studentParam}`);
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

  if (loading) return <Loading variant="section" />;

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <GraduationCap className="w-8 h-8" />
          Penilaian Mahasiswa Bimbingan
        </h1>
        <p className="text-muted-foreground mt-2">
          Nilai mahasiswa bimbingan Anda berdasarkan jadwal atau grup
        </p>
      </div>

      {/* Shared Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          {/* Search + Status Tabs */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kode atau nama grup..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">
                  Semua ({totalCount})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Belum ({pendingCount})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Sudah ({completedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Period + Type dropdowns */}
          <div className="flex flex-wrap gap-4">
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
                  {Object.entries(EVALUATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => {
        const validatedMode = toViewMode(v, viewMode);
        setViewMode(validatedMode);
      }}>
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
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
        <TabsContent value="schedule">
          {filteredSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
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
                        key={`${schedule.schedule_id}-${schedule.evaluation_type}-${schedule.student?.id ?? 'group'}`}
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
                        key={`${schedule.schedule_id}-${schedule.evaluation_type}-${schedule.student?.id ?? 'group'}`}
                        schedule={schedule}
                        onEvaluate={() => handleEvaluateFromSchedule(schedule)}
                        isUrgent={isDeadlineUrgent(schedule.deadline)}
                        isOverdue={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Section — collapsible */}
              {pastSchedules.length > 0 && (
                <div>
                  <button
                    onClick={() => setPastExpanded(!pastExpanded)}
                    className="text-lg font-semibold mb-4 text-gray-500 flex items-center gap-2 hover:text-gray-700 transition-colors w-full text-left"
                  >
                    {pastExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Sudah Lewat ({pastSchedules.length})
                  </button>
                  {pastExpanded && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {pastSchedules.map((schedule) => (
                        <ScheduleCard
                          key={`${schedule.schedule_id}-${schedule.evaluation_type}-${schedule.student?.id ?? 'group'}`}
                          schedule={schedule}
                          onEvaluate={() => handleEvaluateFromSchedule(schedule)}
                          isUrgent={false}
                          isOverdue={isDeadlineOverdue(schedule.deadline) && schedule.status !== 'COMPLETED'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Unscheduled Section — collapsible */}
              {unscheduledEvaluations.length > 0 && (
                <div>
                  <button
                    onClick={() => setUnscheduledExpanded(!unscheduledExpanded)}
                    className="text-lg font-semibold mb-4 text-slate-600 flex items-center gap-2 hover:text-slate-800 transition-colors w-full text-left"
                  >
                    {unscheduledExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Tanpa Jadwal ({unscheduledEvaluations.length})
                  </button>
                  {unscheduledExpanded && (
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
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Group View */}
        <TabsContent value="group">
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === 'all'
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
                        <CardTitle className="text-lg">{group.code || `Group ${group.id}`}</CardTitle>
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
                            <p>Jadwal: {formatDate(evaluation.date)}</p>
                            <p>Ruangan: {evaluation.room || '-'}</p>
                            {evaluation.deadline && (
                              <p>
                                Deadline:{' '}
                                {formatDate(evaluation.deadline)}
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
            {getEvaluationTypeLabel(schedule.evaluation_type)}
          </Badge>
          {getStatusBadge(schedule.status)}
        </div>
        <CardTitle className="text-lg mt-2">{schedule.group.code || `Group ${schedule.group.id}`}</CardTitle>
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
            {schedule.student ? (
              <Badge key={schedule.student.id} variant="secondary" className="text-xs">
                {schedule.student.name}
              </Badge>
            ) : (
              schedule.students?.map((student) => (
                <Badge key={student.id} variant="secondary" className="text-xs">
                  {student.name}
                </Badge>
              ))
            )}
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
