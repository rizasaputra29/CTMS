'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

// Types
interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface ScheduleSummary {
  schedule_id: number;
  schedule_type: string;
  date: string;
  start_time: string;
  end_time: string;
  room: string;
  group_id: number;
  group_name: string;
  group_code: string;
  period_id: number;
  period_name: string;
  student_count: number;
  evaluator_count: number;
  completed_evaluators: number;
  average_score: number | null;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  // Grade columns
  pdc1_score?: number | null;
  pdc2_score?: number | null;
  final_grade?: number | null;
  letter_grade?: string | null;
  grade_status?: 'COMPLETE' | 'INCOMPLETE' | 'PARTIAL';
}

interface Evaluator {
  id: number;
  name: string;
  role: string;
  email?: string;
}

interface Score {
  period_component_id: number;
  component_code: string;
  component_name: string;
  weight: number;
  score: number;
}

interface EvaluatorData {
  evaluator: Evaluator;
  weighted_average: number;
  scores: Score[];
  submitted_at: string | null;
}

interface StudentDetail {
  student: {
    id: number;
    name: string;
    nim: string;
  };
  evaluators: EvaluatorData[];
}

interface ScheduleDetail {
  schedule: {
    id: number;
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
  };
  group: {
    id: number;
    name: string;
    code: string;
    title?: { name: string };
  };
  period: {
    id: number;
    name: string;
  };
  students: StudentDetail[];
}

interface Filters {
  period_id: string;
  type: string;
  status: string;
  search: string;
  date_from: string;
  date_to: string;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Semua Tipe' },
  { value: 'SEMPRO', label: 'SEMPRO' },
  { value: 'SIDANG_TA', label: 'SIDANG TA' },
  { value: 'EXPO', label: 'EXPO' },
  { value: 'BIMBINGAN_SEMPRO', label: 'Bimbingan SEMPRO' },
  { value: 'BIMBINGAN_TA', label: 'Bimbingan TA' },
  { value: 'MILESTONE', label: 'MILESTONE' },
  { value: 'NILAI_DOSEN', label: 'Nilai Dosen' },
  { value: 'PEER_REVIEW', label: 'Peer Review' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua Status' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'PARTIAL', label: 'Sebagian' },
  { value: 'PENDING', label: 'Belum Dinilai' },
];

export default function EvaluationSummaryAnalyticsPage() {
  const router = useRouter();
  
  // Data states
  const [periods, setPeriods] = useState<Period[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;
  
  // Filters
  const [filters, setFilters] = useState<Filters>({
    period_id: '',
    type: 'all',
    status: 'all',
    search: '',
    date_from: '',
    date_to: '',
  });
  
  // Selection for bulk actions
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Fetch periods
  const fetchPeriods = useCallback(async () => {
    try {
      const res = await api.get('/admin/periods');
      const periodsData = res.data?.data || [];
      setPeriods(periodsData);
      const active = periodsData.find((p: Period) => p.is_active);
      if (active) {
        setFilters(prev => ({ ...prev, period_id: active.id.toString() }));
      }
    } catch {
      toast.error('Gagal memuat periode');
    }
  }, []);

  // Fetch schedules with filters
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        per_page: itemsPerPage,
      };
      
      if (filters.period_id && filters.period_id !== 'all') {
        params.period_id = filters.period_id;
      }
      if (filters.type && filters.type !== 'all') {
        params.type = filters.type;
      }
      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.date_from) {
        params.date_from = filters.date_from;
      }
      if (filters.date_to) {
        params.date_to = filters.date_to;
      }

      const res = await api.get('/admin/schedules', { params });
      // Transform response data to match our interface
      const allSchedules = res.data.data || [];
      
      interface ApiSchedule {
        id: number;
        type?: string;
        date: string;
        start_time?: string;
        end_time?: string;
        room?: string;
        group?: {
          id?: number;
          name?: string;
          code?: string;
          period?: { id?: number; name?: string };
          members?: unknown[];
        };
        group_id?: number;
        period_id?: number;
      }

      // Filter by type if specified
      let filteredSchedules: ApiSchedule[] = allSchedules;
      if (filters.type && filters.type !== 'all') {
        filteredSchedules = allSchedules.filter((item: ApiSchedule) => {
          const type = item.type || '';
          return type.toUpperCase().includes(filters.type.toUpperCase());
        });
      }

      // Filter by date range
      if (filters.date_from) {
        filteredSchedules = filteredSchedules.filter((item: ApiSchedule) => item.date >= filters.date_from);
      }
      if (filters.date_to) {
        filteredSchedules = filteredSchedules.filter((item: ApiSchedule) => item.date <= filters.date_to);
      }

      // Filter by search (group name/code)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredSchedules = filteredSchedules.filter((item: ApiSchedule) => {
          const groupId = item.group?.id?.toString() || '';
          return groupId.includes(searchLower);
        });
      }

      // Simple client-side pagination
      const total = filteredSchedules.length;
      const totalPagesCalc = Math.ceil(total / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedSchedules = filteredSchedules.slice(startIndex, startIndex + itemsPerPage);

      const transformedData = paginatedSchedules.map((item: ApiSchedule) => ({
        schedule_id: item.id,
        schedule_type: item.type || 'SCHEDULE',
        date: item.date,
        start_time: item.start_time || '00:00:00',
        end_time: item.end_time || '23:59:59',
        room: item.room || '-',
        group_id: item.group?.id || item.group_id || 0,
        group_name: item.group?.name || 'Unknown Group',
        group_code: item.group?.code || '',
        period_id: item.group?.period?.id || item.period_id || 0,
        period_name: item.group?.period?.name || '',
        student_count: item.group?.members?.length || 0,
        evaluator_count: 0, // Will be calculated from detail
        completed_evaluators: 0, // Will be calculated from detail
        average_score: null, // Will be calculated from detail
        status: 'PENDING' as const, // Will be determined from detail
      }));
      setSchedules(transformedData);
      setTotalPages(totalPagesCalc || 1);
      setTotalItems(total);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      // Use empty data if endpoint doesn't exist yet
      setSchedules([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  // Fetch schedule detail
  const fetchScheduleDetail = useCallback(async (scheduleId: number) => {
    setLoadingDetail(true);
    try {
      interface ApiScheduleDetail {
        id: number;
        start_time?: string;
        end_time?: string;
        group?: {
          title?: { name: string };
          period?: { id?: number; name?: string };
        };
      }

      interface ApiEvaluatorScore {
        component?: string;
        weight?: number;
        score?: number;
      }

      interface ApiEvaluatorData {
        evaluator: Evaluator;
        weighted_average?: number;
        scores?: ApiEvaluatorScore[];
      }

      interface ApiStudentSummary {
        student: StudentDetail['student'];
        scores?: Record<string, ApiEvaluatorData[]>;
      }

      interface ApiSummaryData {
        schedule?: {
          id?: number;
          type?: string;
          date?: string;
          room?: string;
        };
        group?: {
          id?: number;
          name?: string;
          code?: string;
        };
        summary?: ApiStudentSummary[];
      }

      // First, get schedule details from the schedules endpoint
      const schedulesRes = await api.get('/admin/schedules', { params: { period_id: filters.period_id } });
      const allSchedules: ApiScheduleDetail[] = schedulesRes.data.data || [];
      const scheduleDetail = allSchedules.find((s: ApiScheduleDetail) => s.id === scheduleId);

      // Then get evaluation summary
      const summaryRes = await api.get(`/admin/supervisor-evaluation/schedules/${scheduleId}/summary`);
      const summaryData: ApiSummaryData = summaryRes.data;

      // Transform the summary data to match our interface
      // Backend returns: summary[{student, scores: {SEMPRO: [...], BIMBINGAN_SEMPRO: [...]}}]
      // We need: students[{student, evaluators: [...]}]
      const students = (summaryData.summary || []).map((studentSummary: ApiStudentSummary) => {
        // Combine all evaluators from different evaluation types
        const allEvaluators: EvaluatorData[] = [];
        Object.entries(studentSummary.scores || {}).forEach(([, evaluators]) => {
          if (Array.isArray(evaluators)) {
            evaluators.forEach((evaluatorData: ApiEvaluatorData) => {
              // Transform component scores
              const scores = (evaluatorData.scores || []).map((s: ApiEvaluatorScore) => ({
                period_component_id: 0, // Not provided by backend
                component_code: s.component?.substring(0, 10) || 'COMP',
                component_name: s.component || 'Unknown Component',
                weight: s.weight || 0,
                score: s.score || 0,
              }));

              allEvaluators.push({
                evaluator: evaluatorData.evaluator,
                weighted_average: evaluatorData.weighted_average || 0,
                scores: scores,
                submitted_at: null, // Not provided by backend
              });
            });
          }
        });

        return {
          student: studentSummary.student,
          evaluators: allEvaluators,
        };
      });

      // Build the final data structure
      const transformedDetail: ScheduleDetail = {
        schedule: {
          id: summaryData.schedule?.id || scheduleId,
          type: summaryData.schedule?.type || 'SCHEDULE',
          date: summaryData.schedule?.date || scheduleDetail?.id ? new Date().toISOString() : new Date().toISOString(),
          start_time: scheduleDetail?.start_time || '08:00:00',
          end_time: scheduleDetail?.end_time || '17:00:00',
          room: summaryData.schedule?.room || '-',
        },
        group: {
          id: summaryData.group?.id || 0,
          name: summaryData.group?.name || 'Unknown Group',
          code: summaryData.group?.code || '',
          title: scheduleDetail?.group?.title,
        },
        period: {
          id: scheduleDetail?.group?.period?.id || 0,
          name: scheduleDetail?.group?.period?.name || '',
        },
        students: students,
      };

      setSelectedSchedule(transformedDetail);
    } catch (error) {
      console.error('Error fetching detail:', error);
      toast.error('Gagal memuat detail evaluasi');
      setSelectedSchedule(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [filters.period_id]);

  // Initial load
  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // Fetch when filters or page change
  useEffect(() => {
    if (filters.period_id) {
      fetchSchedules();
    }
  }, [fetchSchedules, filters.period_id]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.period_id) {
        setCurrentPage(1);
        fetchSchedules();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search, filters.type, filters.status, filters.date_from, filters.date_to, filters.period_id, fetchSchedules]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: totalItems,
      completed: schedules.filter(s => s.status === 'COMPLETED').length,
      partial: schedules.filter(s => s.status === 'PARTIAL').length,
      pending: schedules.filter(s => s.status === 'PENDING').length,
      withScore: schedules.filter(s => s.average_score !== null).length,
      withGrades: schedules.filter(s => s.final_grade !== null).length,
      gradeComplete: schedules.filter(s => s.grade_status === 'COMPLETE').length,
    };
  }, [schedules, totalItems]);

  // Handle selection
  const toggleSelection = (scheduleId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(scheduleId)) {
        newSet.delete(scheduleId);
      } else {
        newSet.add(scheduleId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedItems(new Set(schedules.map(s => s.schedule_id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  // Export functions
  const handleExportSelected = async () => {
    if (selectedItems.size === 0) {
      toast.error('Pilih minimal satu jadwal untuk diexport');
      return;
    }
    setExporting(true);
    try {
      // Export selected schedules one by one or via bulk endpoint if available
      const scheduleId = Array.from(selectedItems)[0]; // Export first selected
      const res = await api.get(`/admin/supervisor-evaluation/schedules/${scheduleId}/export`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation_summary_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export berhasil');
    } catch {
      toast.error('Gagal export data');
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (filters.period_id && filters.period_id !== 'all') {
        params.period_id = filters.period_id;
      }
      if (filters.type && filters.type !== 'all') {
        params.type = filters.type;
      }
      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.search) {
        params.search = filters.search;
      }

      // Use assessment-scores/summary endpoint which returns all evaluation data
      const res = await api.get('/admin/assessment-scores/summary', {
        params,
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluation_summary_all_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export berhasil');
    } catch {
      toast.error('Export bulk belum tersedia. Silakan export per jadwal.');
    } finally {
      setExporting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Selesai</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><AlertCircle className="w-3 h-3 mr-1" />Sebagian</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Belum Dinilai</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get grade status badge - commented out as unused
  // const getGradeStatusBadge = (status?: string) => {
  //   switch (status) {
  //     case 'COMPLETE':
  //       return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" />Lengkap</Badge>;
  //     case 'PARTIAL':
  //       return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertCircle className="w-3 h-3 mr-1" />Sebagian</Badge>;
  //     case 'INCOMPLETE':
  //       return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Belum Lengkap</Badge>;
  //     default:
  //       return <Badge variant="outline">-</Badge>;
  //   }
  // };

  // Get score color class
  const getScoreColorClass = (score?: number | null) => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= 85) return 'text-emerald-600 font-semibold';
    if (score >= 70) return 'text-blue-600 font-semibold';
    if (score >= 60) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  // Get letter grade badge
  const getLetterGradeBadge = (grade?: string | null) => {
    if (!grade) return <Badge variant="outline">-</Badge>;
    const colorMap: Record<string, string> = {
      'A': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'B': 'bg-blue-100 text-blue-800 border-blue-300',
      'C': 'bg-amber-100 text-amber-800 border-amber-300',
      'D': 'bg-orange-100 text-orange-800 border-orange-300',
      'E': 'bg-red-100 text-red-800 border-red-300',
    };
    return <Badge className={colorMap[grade] || 'bg-gray-100 text-gray-800'}>{grade}</Badge>;
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      period_id: periods.find(p => p.is_active)?.id.toString() || '',
      type: 'all',
      status: 'all',
      search: '',
      date_from: '',
      date_to: '',
    });
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evaluation Summary Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Lihat dan analisis nilai dari semua evaluator dalam satu tampilan
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-muted' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={exporting || selectedItems.size === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export Selected ({selectedItems.size})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Data Terpilih</DialogTitle>
                <DialogDescription>
                  Export {selectedItems.size} jadwal yang dipilih ke format CSV
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => clearSelection()}>
                  Batal Pilih
                </Button>
                <Button onClick={handleExportSelected} disabled={exporting}>
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Export CSV
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleExportAll} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Jadwal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Selesai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Sebagian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Belum Dinilai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Dengan Nilai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withScore}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Grade Lengkap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.gradeComplete}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">Dengan Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.withGrades}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Filter Options</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Periode</Label>
                <Select
                  value={filters.period_id}
                  onValueChange={(v) => setFilters({ ...filters, period_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih periode" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {p.is_active && '(Aktif)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Tipe</Label>
                <Select
                  value={filters.type}
                  onValueChange={(v) => setFilters({ ...filters, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(v) => setFilters({ ...filters, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Dari Tanggal</Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Pencarian</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Kelompok/Mahasiswa..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Master Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Schedule List */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="h-[calc(100vh-400px)] min-h-[500px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Daftar Jadwal</CardTitle>
                <div className="flex gap-2">
                  {selectedItems.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear ({selectedItems.size})
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    Pilih Semua
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : schedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p>Tidak ada jadwal yang sesuai dengan filter</p>
                </div>
              ) : (
                <div className="divide-y">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.schedule_id}
                      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedSchedule?.schedule.id === schedule.schedule_id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                      }`}
                      onClick={() => fetchScheduleDetail(schedule.schedule_id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedItems.has(schedule.schedule_id)}
                          onCheckedChange={() => toggleSelection(schedule.schedule_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <Badge variant="outline" className="text-xs">
                              {schedule.schedule_type}
                            </Badge>
                            {getStatusBadge(schedule.status)}
                          </div>
                          <h3 className="font-medium text-sm truncate">
                            {schedule.group_name}
                          </h3>
                          <p className="text-xs text-muted-foreground">{schedule.group_code}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(schedule.date), 'dd MMM yyyy', { locale: id })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {schedule.start_time?.substring(0, 5)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              <Users className="w-3 h-3 inline mr-1" />
                              {schedule.completed_evaluators}/{schedule.evaluator_count} evaluator
                            </span>
                            <div className="flex items-center gap-2">
                              {schedule.final_grade !== null && schedule.final_grade !== undefined && (
                                <div className="flex items-center gap-1">
                                  {getLetterGradeBadge(schedule.letter_grade)}
                                  <span className={`text-xs ${getScoreColorClass(schedule.final_grade)}`}>
                                    {Number(schedule.final_grade).toFixed(1)}
                                  </span>
                                </div>
                              )}
                              {schedule.average_score !== null && (
                                <Badge variant="secondary" className="text-xs">
                                  Avg: {Number(schedule.average_score).toFixed(1)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            
            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="border-t p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Panel - Detail View */}
        <div className="lg:col-span-7">
          <Card className="h-[calc(100vh-400px)] min-h-[500px] flex flex-col">
            {loadingDetail ? (
              <CardContent className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            ) : !selectedSchedule ? (
              <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Pilih Jadwal</p>
                <p className="text-sm">Klik pada jadwal di sebelah kiri untuk melihat detail evaluasi</p>
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{selectedSchedule.schedule.type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {selectedSchedule.period.name}
                        </span>
                      </div>
                      <CardTitle className="text-xl">Group {selectedSchedule.group.id}</CardTitle>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/evaluation-summary/${selectedSchedule.schedule.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Full
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(parseISO(selectedSchedule.schedule.date), 'EEEE, dd MMMM yyyy', { locale: id })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedSchedule.schedule.start_time?.substring(0, 5)} - {selectedSchedule.schedule.end_time?.substring(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedSchedule.schedule.room}
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-auto p-0">
                  <Tabs defaultValue={selectedSchedule.students[0]?.student.id.toString()} className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-muted/50 px-4 py-2">
                      {selectedSchedule.students.map((studentData) => (
                        <TabsTrigger
                          key={studentData.student.id}
                          value={studentData.student.id.toString()}
                          className="text-xs"
                        >
                          {studentData.student.name.split(' ')[0]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {selectedSchedule.students.map((studentData) => (
                      <TabsContent
                        key={studentData.student.id}
                        value={studentData.student.id.toString()}
                        className="m-0 p-4"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{studentData.student.name}</h3>
                              <p className="text-sm text-muted-foreground">{studentData.student.nim}</p>
                            </div>
                          </div>

                          {/* Grade Summary Cards */}
                          <div className="grid grid-cols-3 gap-3">
                            <Card className="bg-blue-50 border-blue-200">
                              <CardHeader className="pb-1 pt-3 px-3">
                                <CardTitle className="text-xs text-blue-600">PDC 1</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0 pb-3 px-3">
                                <div className="text-lg font-bold text-blue-700">
                                  {(studentData as {pdc1_score?: number}).pdc1_score !== undefined ? Number((studentData as {pdc1_score?: number}).pdc1_score).toFixed(1) : '-'}
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="bg-purple-50 border-purple-200">
                              <CardHeader className="pb-1 pt-3 px-3">
                                <CardTitle className="text-xs text-purple-600">PDC 2</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0 pb-3 px-3">
                                <div className="text-lg font-bold text-purple-700">
                                  {(studentData as {pdc2_score?: number}).pdc2_score !== undefined ? Number((studentData as {pdc2_score?: number}).pdc2_score).toFixed(1) : '-'}
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="bg-emerald-50 border-emerald-200">
                              <CardHeader className="pb-1 pt-3 px-3">
                                <CardTitle className="text-xs text-emerald-600">Final</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0 pb-3 px-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-bold text-emerald-700">
                                    {(studentData as {final_grade?: number}).final_grade !== undefined ? Number((studentData as {final_grade?: number}).final_grade).toFixed(1) : '-'}
                                  </span>
                                  {(studentData as {letter_grade?: string}).letter_grade && (
                                    <Badge className="bg-emerald-100 text-emerald-800">
                                      {(studentData as {letter_grade?: string}).letter_grade}
                                    </Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <Separator />

                          {studentData.evaluators.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>Belum ada evaluator yang menilai</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {studentData.evaluators.map((evaluatorData, idx) => (
                                <Card key={idx} className="border-muted">
                                  <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <CardTitle className="text-sm font-medium">
                                          {evaluatorData.evaluator.name}
                                        </CardTitle>
                                        <Badge variant="outline" className="mt-1 text-xs">
                                          {evaluatorData.evaluator.role}
                                        </Badge>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Rata-rata Tertimbang</p>
                                        <p className="text-xl font-bold text-primary">
                                          {Number(evaluatorData.weighted_average).toFixed(2)}
                                        </p>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs">Komponen</TableHead>
                                          <TableHead className="text-xs text-right">Bobot</TableHead>
                                          <TableHead className="text-xs text-right">Nilai</TableHead>
                                          <TableHead className="text-xs text-right">Tertimbang</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {evaluatorData.scores.map((score, sIdx) => (
                                          <TableRow key={sIdx}>
                                            <TableCell className="text-xs py-1">
                                              <span className="font-medium">{score.component_code}</span>
                                              <span className="text-muted-foreground ml-1">- {score.component_name}</span>
                                            </TableCell>
                                            <TableCell className="text-xs text-right py-1">{score.weight}%</TableCell>
                                            <TableCell className="text-xs text-right py-1 font-medium">{score.score}</TableCell>
                                            <TableCell className="text-xs text-right py-1">
                                              {((Number(score.score) * Number(score.weight)) / 100).toFixed(2)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
