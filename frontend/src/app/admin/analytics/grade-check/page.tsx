'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowUpDown,
} from 'lucide-react';

// Types
interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface Group {
  id: number;
  code: string;
  name: string;
}

interface Student {
  id: number;
  name: string;
  nim?: string;
}

interface Evaluator {
  id: number;
  name: string;
  role: string;
}

interface ComponentScore {
  code: string;
  name: string;
  raw_score?: number;
  converted_score?: number;
  score: number;
  weight: number;
}

interface GradeCheckItem {
  id: number;
  group: Group;
  student: Student | null;
  evaluation_type: string;
  evaluator: Evaluator;
  component_scores: ComponentScore[];
  weighted_average: number;
  submitted_at: string;
  notes?: string;
}

interface StudentGradeSummary {
  student: Student;
  group: Group;
  pdc1: {
    score: number | null;
    semproScores: number[];
    bimbinganScores: number[];
  };
  pdc2: {
    score: number | null;
    nilaiDosen: number | null;
    milestone: number | null;
    expo: number | null;
    peerReview: number | null;
  };
  sidangTA: {
    score: number | null;
    sidangTaScores: number[];
    bimbinganTaScores: number[];
  };
  finalScore: number | null;
  status: 'COMPLETE' | 'PARTIAL';
}

interface PaginationData {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

type SortField = 'student' | 'group' | 'pdc1' | 'pdc2' | 'sidangTA' | 'final' | 'status';
type SortDirection = 'asc' | 'desc';

const PER_PAGE_OPTIONS = [25, 50, 100];

export default function GradeCheckPage() {
  const router = useRouter();
  
  // State
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [studentSummaries, setStudentSummaries] = useState<StudentGradeSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<StudentGradeSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField>('student');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [perPage, setPerPage] = useState<number>(25);

  // Fetch periods on mount
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await api.get('/admin/periods');
        const periodsData = res.data?.data || [];
        setPeriods(periodsData);
        
        // Select active period by default
        const active = periodsData.find((p: Period) => p.is_active);
        if (active) {
          setSelectedPeriod(active.id.toString());
        }
      } catch {
        toast.error('Failed to load periods');
      }
    };
    fetchPeriods();
  }, []);

  // Fetch groups when period changes
  useEffect(() => {
    const fetchGroups = async () => {
      if (!selectedPeriod) {
        setGroups([]);
        return;
      }
      try {
        const res = await api.get(`/admin/groups?period_id=${selectedPeriod}`);
        setGroups(res.data?.data || []);
      } catch (error) {
        console.error('Failed to load groups:', error);
      }
    };
    fetchGroups();
  }, [selectedPeriod]);

  // Transform raw data to student summaries
  const transformToStudentSummaries = useCallback((data: GradeCheckItem[]): StudentGradeSummary[] => {
    // Group by student
    const groupedByStudent = data.reduce((acc, item) => {
      if (!item.student) return acc;
      
      const studentId = item.student.id;
      if (!acc[studentId]) {
        acc[studentId] = {
          student: item.student,
          group: item.group,
          items: [],
        };
      }
      acc[studentId].items.push(item);
      return acc;
    }, {} as Record<number, { student: Student; group: Group; items: GradeCheckItem[] }>);

    // Calculate summaries
    return Object.values(groupedByStudent).map((group) => {
      const items = group.items;

      // Get scores by type
      const semproItems = items.filter(i => i.evaluation_type === 'SEMPRO');
      const bimbinganSemproItems = items.filter(i => i.evaluation_type === 'BIMBINGAN_SEMPRO');
      const nilaiDosenItems = items.filter(i => i.evaluation_type === 'NILAI_DOSEN');
      const milestoneItems = items.filter(i => i.evaluation_type === 'MILESTONE');
      const expoItems = items.filter(i => i.evaluation_type === 'EXPO');
      const peerReviewItems = items.filter(i => i.evaluation_type === 'PEER_REVIEW');
      const sidangTaItems = items.filter(i => i.evaluation_type === 'SIDANG_TA');
      const bimbinganTaItems = items.filter(i => i.evaluation_type === 'BIMBINGAN_TA');

      // Calculate PDC1
      const semproScores = semproItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      const bimbinganSemproScores = bimbinganSemproItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      const semproAvg = semproScores.length > 0 
        ? semproScores.reduce((a, b) => a + b, 0) / semproScores.length 
        : null;
      const bimbinganSemproAvg = bimbinganSemproScores.length > 0 
        ? bimbinganSemproScores.reduce((a, b) => a + b, 0) / bimbinganSemproScores.length 
        : null;
      const pdc1Components = [semproAvg, bimbinganSemproAvg].filter((s): s is number => s !== null);
      const pdc1 = pdc1Components.length > 0 
        ? pdc1Components.reduce((a, b) => a + b, 0) / pdc1Components.length 
        : null;

      // Calculate PDC2
      const nilaiDosenScores = nilaiDosenItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      const milestoneScores = milestoneItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      const expoScores = expoItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      const peerReviewScores = peerReviewItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      
      const nilaiDosenAvg = nilaiDosenScores.length > 0 
        ? nilaiDosenScores.reduce((a, b) => a + b, 0) / nilaiDosenScores.length 
        : null;
      const milestoneAvg = milestoneScores.length > 0 
        ? milestoneScores.reduce((a, b) => a + b, 0) / milestoneScores.length 
        : null;
      const expoAvg = expoScores.length > 0 
        ? expoScores.reduce((a, b) => a + b, 0) / expoScores.length 
        : null;
      const peerReviewAvg = peerReviewScores.length > 0 
        ? peerReviewScores.reduce((a, b) => a + b, 0) / peerReviewScores.length 
        : null;
      
      const pdc2Components = [nilaiDosenAvg, milestoneAvg, expoAvg, peerReviewAvg].filter((s): s is number => s !== null);
      const pdc2 = pdc2Components.length > 0 
        ? pdc2Components.reduce((a, b) => a + b, 0) / pdc2Components.length 
        : null;

      // Calculate Sidang TA (SIDANG_TA + BIMBINGAN_TA) / 2
      const sidangTaScoresList = sidangTaItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      const bimbinganTaScoresList = bimbinganTaItems.map(i => safeNumber(i.weighted_average)).filter((s): s is number => s !== null);
      
      const sidangTaAvg = sidangTaScoresList.length > 0 
        ? sidangTaScoresList.reduce((a, b) => a + b, 0) / sidangTaScoresList.length 
        : null;
      const bimbinganTaAvg = bimbinganTaScoresList.length > 0 
        ? bimbinganTaScoresList.reduce((a, b) => a + b, 0) / bimbinganTaScoresList.length 
        : null;
      
      const sidangTaComponents = [sidangTaAvg, bimbinganTaAvg].filter((s): s is number => s !== null);
      const sidangTA = sidangTaComponents.length > 0 
        ? sidangTaComponents.reduce((a, b) => a + b, 0) / sidangTaComponents.length 
        : null;

      // Calculate Final
      const finalComponents = [pdc1, pdc2, sidangTA].filter((s): s is number => s !== null);
      const finalScore = finalComponents.length > 0 
        ? finalComponents.reduce((a, b) => a + b, 0) / finalComponents.length 
        : null;

      // Determine status
      const hasAllScores = pdc1 !== null && pdc2 !== null && sidangTA !== null;

      return {
        student: group.student,
        group: group.group,
        pdc1: {
          score: pdc1,
          semproScores,
          bimbinganScores: bimbinganSemproScores,
        },
        pdc2: {
          score: pdc2,
          nilaiDosen: nilaiDosenAvg,
          milestone: milestoneAvg,
          expo: expoAvg,
          peerReview: peerReviewAvg,
        },
        sidangTA: {
          score: sidangTA,
          sidangTaScores: sidangTaScoresList,
          bimbinganTaScores: bimbinganTaScoresList,
        },
        finalScore,
        status: hasAllScores ? 'COMPLETE' : 'PARTIAL',
      };
    });
  }, []);

  // Fetch grade check data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build base params
      const baseParams = new URLSearchParams();
      if (selectedPeriod) baseParams.append('period_id', selectedPeriod);
      if (selectedGroup && selectedGroup !== 'all') baseParams.append('group_id', selectedGroup);
      baseParams.append('per_page', '500'); // Increased to handle larger datasets

      // Fetch each evaluation type separately to ensure we get all data
      // PDC1 types
      const semproParams = new URLSearchParams(baseParams);
      semproParams.set('evaluation_type', 'SEMPRO');
      const semproRes = await api.get(`/admin/grade-check?${semproParams.toString()}`);

      const bimbinganSemproParams = new URLSearchParams(baseParams);
      bimbinganSemproParams.set('evaluation_type', 'BIMBINGAN_SEMPRO');
      const bimbinganSemproRes = await api.get(`/admin/grade-check?${bimbinganSemproParams.toString()}`);

      // PDC2 types
      const nilaiDosenParams = new URLSearchParams(baseParams);
      nilaiDosenParams.set('evaluation_type', 'NILAI_DOSEN');
      const nilaiDosenRes = await api.get(`/admin/grade-check?${nilaiDosenParams.toString()}`);

      const milestoneParams = new URLSearchParams(baseParams);
      milestoneParams.set('evaluation_type', 'MILESTONE');
      const milestoneRes = await api.get(`/admin/grade-check?${milestoneParams.toString()}`);

      const expoParams = new URLSearchParams(baseParams);
      expoParams.set('evaluation_type', 'EXPO');
      const expoRes = await api.get(`/admin/grade-check?${expoParams.toString()}`);

      // Sidang TA types
      const sidangTaParams = new URLSearchParams(baseParams);
      sidangTaParams.set('evaluation_type', 'SIDANG_TA');
      const sidangTaRes = await api.get(`/admin/grade-check?${sidangTaParams.toString()}`);

      const bimbinganTaParams = new URLSearchParams(baseParams);
      bimbinganTaParams.set('evaluation_type', 'BIMBINGAN_TA');
      const bimbinganTaRes = await api.get(`/admin/grade-check?${bimbinganTaParams.toString()}`);

      // Peer reviews
      const peerParams = new URLSearchParams(baseParams);
      peerParams.set('evaluation_type', 'PEER_REVIEW');
      const peerRes = await api.get(`/admin/grade-check?${peerParams.toString()}`);

      // Combine all data
      const allData = [
        ...(semproRes.data?.data || []),
        ...(bimbinganSemproRes.data?.data || []),
        ...(nilaiDosenRes.data?.data || []),
        ...(milestoneRes.data?.data || []),
        ...(expoRes.data?.data || []),
        ...(sidangTaRes.data?.data || []),
        ...(bimbinganTaRes.data?.data || []),
        ...(peerRes.data?.data || []),
      ];

      // Transform to student summaries
      const summaries = transformToStudentSummaries(allData);
      setStudentSummaries(summaries);
      
      // Apply initial pagination
      setPagination({
        current_page: 1,
        last_page: Math.ceil(summaries.length / perPage),
        per_page: perPage,
        total: summaries.length,
      });
    } catch (error) {
      toast.error('Failed to load grade check data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedGroup, perPage, transformToStudentSummaries]);

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and sort summaries
  useEffect(() => {
    let filtered = [...studentSummaries];

    // Apply search filter
    if (searchStudent) {
      const searchLower = searchStudent.toLowerCase();
      filtered = filtered.filter(s => 
        s.student.name.toLowerCase().includes(searchLower) ||
        s.student.nim?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'student':
          comparison = a.student.name.localeCompare(b.student.name);
          break;
        case 'group':
          comparison = a.group.code.localeCompare(b.group.code);
          break;
        case 'pdc1':
          comparison = (a.pdc1.score ?? -1) - (b.pdc1.score ?? -1);
          break;
        case 'pdc2':
          comparison = (a.pdc2.score ?? -1) - (b.pdc2.score ?? -1);
          break;
        case 'sidangTA':
          comparison = (a.sidangTA.score ?? -1) - (b.sidangTA.score ?? -1);
          break;
        case 'final':
          comparison = (a.finalScore ?? -1) - (b.finalScore ?? -1);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredSummaries(filtered);
    
    // Update pagination
    setPagination(prev => ({
      ...prev,
      last_page: Math.ceil(filtered.length / perPage),
      total: filtered.length,
    }));
  }, [studentSummaries, searchStudent, sortField, sortDirection, perPage]);

  // Get current page data
  const currentPageData = useMemo(() => {
    const start = (pagination.current_page - 1) * perPage;
    const end = start + perPage;
    return filteredSummaries.slice(start, end);
  }, [filteredSummaries, pagination.current_page, perPage]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period_id', selectedPeriod);
      
      const res = await api.get(`/admin/grade-check/export?${params.toString()}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `grade-check-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Export downloaded successfully');
    } catch {
      toast.error('Failed to export data');
    }
  };

  // Get score color
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  // Safe number conversion helper
  const safeNumber = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  };

  // Format score
  const formatScore = (score: number | null) => {
    if (score === null || score === undefined) return 'not scored yet';
    return Number(score).toFixed(1);
  };

  // Render sort header
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grade Check</h1>
          <p className="text-muted-foreground">
            View consolidated grade summaries (PDC1, PDC2, Sidang TA, and Final scores)
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters Card */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-primary" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter grade check data by period, group, or student
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Period Filter */}
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger id="period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id.toString()}>
                      {period.name} {period.is_active && '(Active)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group Filter */}
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger id="group">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.code} - {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student Search */}
            <div className="space-y-2">
              <Label htmlFor="student-search">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-search"
                  placeholder="Student name or NIM..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card className="shadow-xl">
        <CardHeader className="bg-muted/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Grade Check Results
            </CardTitle>
            <CardDescription>
              {pagination.total} students found
            </CardDescription>
          </div>
          
          {/* Per Page Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="per-page" className="text-sm text-muted-foreground">Show:</Label>
            <Select value={perPage.toString()} onValueChange={(v) => setPerPage(parseInt(v))}>
              <SelectTrigger id="per-page" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt.toString()}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : currentPageData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
              <p className="text-muted-foreground max-w-md">
                No grade check data matches your current filters. Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <SortHeader field="student">Student</SortHeader>
                      <SortHeader field="group">Group</SortHeader>
                      <SortHeader field="pdc1">PDC1</SortHeader>
                      <SortHeader field="pdc2">PDC2</SortHeader>
                      <SortHeader field="sidangTA">Sidang TA</SortHeader>
                      <SortHeader field="final">Final</SortHeader>
                      <SortHeader field="status">Status</SortHeader>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageData.map((summary) => (
                      <TableRow key={summary.student.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium">{summary.student.name}</div>
                          {summary.student.nim && (
                            <div className="text-xs text-muted-foreground">{summary.student.nim}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{summary.group.code}</div>
                          <div className="text-xs text-muted-foreground">{summary.group.name}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${getScoreColor(summary.pdc1.score)}`}>
                            {formatScore(summary.pdc1.score)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${getScoreColor(summary.pdc2.score)}`}>
                            {formatScore(summary.pdc2.score)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${getScoreColor(summary.sidangTA.score)}`}>
                            {formatScore(summary.sidangTA.score)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${getScoreColor(summary.finalScore)}`}>
                            {formatScore(summary.finalScore)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={summary.status === 'COMPLETE' ? 'default' : 'secondary'}
                            className={summary.status === 'COMPLETE' 
                              ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                            }
                          >
                            {summary.status === 'COMPLETE' ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</>
                            ) : (
                              <><AlertCircle className="h-3 w-3 mr-1" /> Partial</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/analytics/grade-check/${summary.student.id}?period_id=${selectedPeriod}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.current_page - 1) * perPage + 1} to{' '}
                  {Math.min(pagination.current_page * perPage, pagination.total)} of{' '}
                  {pagination.total} students
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, current_page: prev.current_page - 1 }))}
                    disabled={pagination.current_page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm">
                    Page {pagination.current_page} of {pagination.last_page}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, current_page: prev.current_page + 1 }))}
                    disabled={pagination.current_page === pagination.last_page || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span>80-100 (Excellent)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>60-79 (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>&lt;60 (Needs Improvement)</span>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
              </Badge>
              <span className="text-muted-foreground">All scores available</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <AlertCircle className="h-3 w-3 mr-1" /> Partial
              </Badge>
              <span className="text-muted-foreground">Some scores missing</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
