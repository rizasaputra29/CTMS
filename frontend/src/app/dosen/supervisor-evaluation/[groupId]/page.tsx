'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loading } from '@/components/ui/loading';
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Calendar, 
  MapPin, 
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useStringParam } from '@/hooks/use-params';
import { getApiErrorMessage } from '@/lib/error-utils';

interface Component {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
}

interface StudentScore {
  period_component_id: number;
  code: string;
  name: string;
  weight: number;
  score: number | null;
  notes: string | null;
}

interface Student {
  id: number;
  name: string;
  nim: string;
  is_leader: boolean;
  scores: StudentScore[];
}

interface Schedule {
  id: number;
  type: string;
  date: string;
  room: string;
  evaluation_deadline: string | null;
}

interface Group {
  id: number;
  name: string;
  code: string;
  title?: { name: string };
  members: Student[];
}

export default function SupervisorEvaluationDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupId = useStringParam('groupId');
  const evaluationType = searchParams.get('type') || 'BIMBINGAN_SEMPRO';
  const studentId = searchParams.get('student_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isViewOnly, setIsViewOnly] = useState(false);

  const fetchEvaluationForm = useCallback(async () => {
    try {
      setLoading(true);
      const studentParam = studentId ? `&student_id=${studentId}` : '';
      const response = await api.get(`/dosen/supervisor-evaluation/form/${groupId}?type=${evaluationType}${studentParam}`);
      const data = response.data?.data ?? response.data;
      
      setGroup(data.group);
      setSchedule(data.schedule);
      setComponents(data.components ?? []);
      setStudents(data.students ?? []);

      // Initialize scores and notes
      const initialScores: Record<string, number> = {};
      const initialNotes: Record<string, string> = {};
      let hasExistingScores = false;

      (data.students ?? []).forEach((student: Student) => {
        (student.scores ?? []).forEach((score: StudentScore) => {
          const key = `${score.period_component_id}_${student.id}`;
          initialScores[key] = score.score || 0;
          initialNotes[key] = score.notes || '';
          if (score.score !== null && score.score !== undefined) {
            hasExistingScores = true;
          }
        });
      });

      setScores(initialScores);
      setNotes(initialNotes);
      setIsViewOnly(hasExistingScores);
    } catch (error) {
      console.error('Error fetching evaluation form:', error);
      toast.error(getApiErrorMessage(error) || 'Gagal memuat form penilaian');
      // Check if it's a 400 error
      if (api.isAxiosError(error) && error.response?.status === 400) {
        router.push('/dosen/supervisor-evaluation');
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, evaluationType, studentId, router]);

  useEffect(() => {
    if (groupId && evaluationType) {
      fetchEvaluationForm();
    }
  }, [groupId, evaluationType, fetchEvaluationForm]);

  const handleScoreChange = (componentId: number, studentId: number, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseFloat(value) || 0));
    setScores(prev => ({ ...prev, [`${componentId}_${studentId}`]: numValue }));
  };

  const handleNoteChange = (componentId: number, studentId: number, value: string) => {
    setNotes(prev => ({ ...prev, [`${componentId}_${studentId}`]: value }));
  };

  const calculateTotalScore = (studentId: number) => {
    let total = 0;
    components.forEach(comp => {
      const score = scores[`${comp.id}_${studentId}`] || 0;
      total += (score * comp.weight) / 100;
    });
    return total.toFixed(2);
  };

  const validateScores = () => {
    for (const student of students) {
      for (const component of components) {
        const score = scores[`${component.id}_${student.id}`];
        if (score === undefined || score === null || score < 0 || score > 100) {
          toast.error(`Nilai tidak valid untuk ${student.name} - ${component.name}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateScores()) return;

    try {
      setSaving(true);
      
      // Flatten scores for all students
      const scorePayload = students.flatMap((student) =>
        components.map((comp) => ({
          period_component_id: comp.id,
          student_id: student.id,
          score: scores[`${comp.id}_${student.id}`] || 0,
          notes: notes[`${comp.id}_${student.id}`] || '',
        }))
      );

      await api.post('/dosen/supervisor-evaluation', {
        group_id: groupId ? parseInt(groupId) : null,
        evaluation_type: evaluationType,
        scores: scorePayload,
      });

      toast.success('Penilaian berhasil disimpan');
      router.push('/dosen/supervisor-evaluation');
    } catch (error) {
      console.error('Error saving evaluation:', error);
      toast.error(getApiErrorMessage(error) || 'Gagal menyimpan penilaian');
    } finally {
      setSaving(false);
    }
  };

  const getEvaluationTypeLabel = () => {
    switch (evaluationType) {
      case 'BIMBINGAN_SEMPRO':
        return 'Penilaian BIMBINGAN SEMPRO';
      case 'NILAI_DOSEN':
        return 'Penilaian NILAI_DOSEN';
      case 'EXPO':
        return 'Penilaian EXPO';
      case 'MILESTONE':
        return 'Penilaian MILESTONE';
      case 'BIMBINGAN_TA':
        return 'Penilaian BIMBINGAN Sidang TA';
      default:
        return evaluationType;
    }
  };

  const getEvaluationTypeDescription = () => {
    switch (evaluationType) {
      case 'BIMBINGAN_SEMPRO':
        return 'Penilaian komponen CPMK untuk Seminar Proposal oleh Dosen Pembimbing';
      case 'NILAI_DOSEN':
        return 'Penilaian dosen pembimbing pada fase PDC2';
      case 'EXPO':
        return 'Penilaian komponen CPMK untuk Expo oleh Dosen Pembimbing';
      case 'MILESTONE':
        return 'Penilaian kesesuaian milestone proyek oleh Dosen Pembimbing';
      case 'BIMBINGAN_TA':
        return 'Penilaian komponen CPMK untuk Sidang TA oleh Dosen Pembimbing';
      default:
        return '';
    }
  };

  if (loading) return <Loading variant="section" />;

  if (!group) {
    return (
      <div className="container py-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Form Penilaian Tidak Ditemukan</h2>
        <Button onClick={() => router.back()} className="mt-4">Kembali</Button>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {getEvaluationTypeLabel()}
            </h1>
            <p className="text-muted-foreground">
              {getEvaluationTypeDescription()}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          Dosen Pembimbing
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-primary/20 shadow-lg overflow-hidden">
            <div className="h-2 bg-primary" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Informasi Kelompok
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                {group.title && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase font-semibold">Judul Proyek</Label>
                    <p className="font-medium text-sm leading-tight text-primary">{group.title.name}</p>
                  </div>
                )}
                <Separator className="bg-primary/10" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase font-semibold">Group</Label>
                  <p className="font-medium">{group.code || `Group ${group.id}`}</p>
                </div>
                <Separator className="bg-primary/10" />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-semibold">Anggota</Label>
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center gap-3 bg-background p-2 rounded-lg border border-primary/5 shadow-sm">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.nim}</p>
                      </div>
                      {student.is_leader && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Ketua
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {schedule && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(schedule.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{schedule.type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{schedule.room || 'TBA'}</span>
                  </div>
                  {schedule.evaluation_deadline && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <Clock className="h-4 w-4" />
                      <span>Deadline: {formatDate(schedule.evaluation_deadline)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Informasi Penilaian</CardTitle>
              <CardDescription>Panduan memberikan nilai</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• Nilai range: 0 - 100</p>
                <p>• Setiap komponen memiliki bobot tertentu</p>
                <p>• Nilai akhir dihitung secara otomatis</p>
                <p>• Catatan bersifat opsional</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Rubric */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="shadow-xl">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Assessment Rubric</CardTitle>
                  <CardDescription>
                    {isViewOnly
                      ? 'Lihat nilai yang telah disubmit (mode read-only)'
                      : 'Masukkan nilai (0-100) untuk setiap komponen penilaian'}
                  </CardDescription>
                </div>
                {isViewOnly && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    Lihat Nilai
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {components.map((comp) => (
                  <div key={comp.id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">{comp.code}</span>
                          <h3 className="font-bold text-lg">{comp.name}</h3>
                        </div>
                        {comp.description && (
                          <p className="text-sm text-muted-foreground">{comp.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-muted-foreground uppercase">Bobot</p>
                        <p className="text-lg font-extrabold text-primary">{comp.weight}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {students.map((student) => (
                        <div key={student.id} className="space-y-2">
                          <Label className="text-xs flex justify-between">
                            <span>{student.name}</span>
                            <span className="font-bold text-primary">Nilai: {scores[`${comp.id}_${student.id}`] || 0}</span>
                          </Label>
                          <div className="flex gap-4 items-start">
                            <div className="w-1/3">
                              <Input
                                type="number"
                                className="text-center font-bold"
                                placeholder={isViewOnly ? "-" : "0-100"}
                                value={scores[`${comp.id}_${student.id}`] || ''}
                                onChange={(e) => handleScoreChange(comp.id, student.id, e.target.value)}
                                disabled={isViewOnly}
                                readOnly={isViewOnly}
                              />
                            </div>
                            <div className="flex-1">
                              <Textarea
                                placeholder={isViewOnly ? "Tidak ada catatan" : "Catatan/feedback (opsional)..."}
                                className="h-10 min-h-[40px] text-sm py-2"
                                value={notes[`${comp.id}_${student.id}`] || ''}
                                onChange={(e) => handleNoteChange(comp.id, student.id, e.target.value)}
                                disabled={isViewOnly}
                                readOnly={isViewOnly}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="border-primary shadow-lg bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-muted-foreground">Ringkasan Nilai</h4>
                  <div className="flex gap-4">
                    {students.map(student => (
                      <div key={student.id} className="text-center">
                        <p className="text-xs text-muted-foreground">{student.name.split(' ')[0]}</p>
                        <p className="text-2xl font-black text-primary">{calculateTotalScore(student.id)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4">
                  {isViewOnly ? (
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-8 font-bold"
                      onClick={() => router.push('/dosen/supervisor-evaluation')}
                    >
                      Kembali
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => router.push('/dosen/supervisor-evaluation')}
                      >
                        Batal
                      </Button>
                      <Button
                        size="lg"
                        className="px-8 font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                        onClick={handleSubmit}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            Simpan Penilaian
                            <Save className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
