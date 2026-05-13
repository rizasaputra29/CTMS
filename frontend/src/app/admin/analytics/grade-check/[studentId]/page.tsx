'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  ArrowLeft,
  User,
  Users,
  GraduationCap,
  FileText,
  Star,
  ClipboardCheck,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';

// Types
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
  group: {
    id: number;
    code: string;
    name: string;
  };
  student: {
    id: number;
    name: string;
    nim?: string;
  } | null;
  evaluation_type: string;
  evaluator: Evaluator;
  component_scores: ComponentScore[];
  weighted_average: number;
  submitted_at: string;
  notes?: string;
  status?: string;
}

interface StudentInfo {
  id: number;
  name: string;
  nim?: string;
}

interface GroupInfo {
  id: number;
  code: string;
  name: string;
}

interface ScoreBreakdown {
  score: number | null;
  evaluators: {
    name: string;
    role: string;
    score: number | null;
    submitted_at: string;
  }[];
}

export default function StudentGradeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const periodId = searchParams.get('period_id');

  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  
  // Score breakdowns
  const [pdc1Breakdown, setPdc1Breakdown] = useState<{
    sempro: ScoreBreakdown;
    bimbinganSempro: ScoreBreakdown;
    total: number | null;
  } | null>(null);
  
  const [pdc2Breakdown, setPdc2Breakdown] = useState<{
    nilaiDosen: ScoreBreakdown;
    milestone: ScoreBreakdown;
    expo: ScoreBreakdown;
    peerReview: ScoreBreakdown;
    total: number | null;
  } | null>(null);
  
  const [sidangTABreakdown, setSidangTABreakdown] = useState<{
    sidangTA: ScoreBreakdown;
    bimbinganTA: ScoreBreakdown;
    total: number | null;
  } | null>(null);

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [status, setStatus] = useState<'COMPLETE' | 'PARTIAL'>('PARTIAL');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (periodId) params.append('period_id', periodId);
        params.append('student_id', studentId);

        const res = await api.get(`/admin/grade-check?${params.toString()}`);
        const data: GradeCheckItem[] = res.data?.data || [];

        if (data.length === 0) {
          toast.error('No data found for this student');
          return;
        }

        // Get student and group info from first item
        const firstItem = data[0];
        if (firstItem.student) {
          setStudentInfo(firstItem.student);
        }
        setGroupInfo(firstItem.group);

        // Process PDC1 data
        const semproItems = data.filter(i => i.evaluation_type === 'SEMPRO');
        const bimbinganSemproItems = data.filter(i => i.evaluation_type === 'BIMBINGAN_SEMPRO');
        
        const semproBreakdown: ScoreBreakdown = {
          score: semproItems.length > 0 
            ? semproItems.reduce((sum, i) => sum + i.weighted_average, 0) / semproItems.length 
            : null,
          evaluators: semproItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: i.weighted_average,
            submitted_at: i.submitted_at,
          })),
        };

        const bimbinganSemproBreakdown: ScoreBreakdown = {
          score: bimbinganSemproItems.length > 0 
            ? bimbinganSemproItems.reduce((sum, i) => sum + i.weighted_average, 0) / bimbinganSemproItems.length 
            : null,
          evaluators: bimbinganSemproItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: i.weighted_average,
            submitted_at: i.submitted_at,
          })),
        };

        const pdc1Scores = [semproBreakdown.score, bimbinganSemproBreakdown.score].filter((s): s is number => s !== null);
        const pdc1Total = pdc1Scores.length > 0 ? pdc1Scores.reduce((a, b) => a + b, 0) / pdc1Scores.length : null;

        setPdc1Breakdown({
          sempro: semproBreakdown,
          bimbinganSempro: bimbinganSemproBreakdown,
          total: pdc1Total,
        });

        // Process PDC2 data
        const nilaiDosenItems = data.filter(i => i.evaluation_type === 'NILAI_DOSEN');
        const milestoneItems = data.filter(i => i.evaluation_type === 'MILESTONE');
        const expoItems = data.filter(i => i.evaluation_type === 'EXPO');
        const peerReviewItems = data.filter(i => i.evaluation_type === 'PEER_REVIEW');

        const nilaiDosenBreakdown: ScoreBreakdown = {
          score: nilaiDosenItems.length > 0 
            ? nilaiDosenItems.reduce((sum, i) => sum + (safeNumber(i.weighted_average) || 0), 0) / nilaiDosenItems.length 
            : null,
          evaluators: nilaiDosenItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: safeNumber(i.weighted_average),
            submitted_at: i.submitted_at,
          })).filter(e => e.score !== null),
        };

        const milestoneBreakdown: ScoreBreakdown = {
          score: milestoneItems.length > 0 
            ? milestoneItems.reduce((sum, i) => sum + (safeNumber(i.weighted_average) || 0), 0) / milestoneItems.length 
            : null,
          evaluators: milestoneItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: safeNumber(i.weighted_average),
            submitted_at: i.submitted_at,
          })).filter(e => e.score !== null),
        };

        const expoBreakdown: ScoreBreakdown = {
          score: expoItems.length > 0 
            ? expoItems.reduce((sum, i) => sum + (safeNumber(i.weighted_average) || 0), 0) / expoItems.length 
            : null,
          evaluators: expoItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: safeNumber(i.weighted_average),
            submitted_at: i.submitted_at,
          })).filter(e => e.score !== null),
        };

        const peerReviewBreakdown: ScoreBreakdown = {
          score: peerReviewItems.length > 0 
            ? peerReviewItems.reduce((sum, i) => sum + (safeNumber(i.weighted_average) || 0), 0) / peerReviewItems.length 
            : null,
          evaluators: peerReviewItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: safeNumber(i.weighted_average),
            submitted_at: i.submitted_at,
          })).filter(e => e.score !== null),
        };

        const pdc2Scores = [
          nilaiDosenBreakdown.score, 
          milestoneBreakdown.score, 
          expoBreakdown.score, 
          peerReviewBreakdown.score
        ].filter((s): s is number => s !== null);
        const pdc2Total = pdc2Scores.length > 0 ? pdc2Scores.reduce((a, b) => a + b, 0) / pdc2Scores.length : null;

        setPdc2Breakdown({
          nilaiDosen: nilaiDosenBreakdown,
          milestone: milestoneBreakdown,
          expo: expoBreakdown,
          peerReview: peerReviewBreakdown,
          total: pdc2Total,
        });

        // Process Sidang TA data
        const sidangTaItems = data.filter(i => i.evaluation_type === 'SIDANG_TA');
        const bimbinganTaItems = data.filter(i => i.evaluation_type === 'BIMBINGAN_TA');

        const sidangTaBreakdown: ScoreBreakdown = {
          score: sidangTaItems.length > 0 
            ? sidangTaItems.reduce((sum, i) => sum + (safeNumber(i.weighted_average) || 0), 0) / sidangTaItems.length 
            : null,
          evaluators: sidangTaItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: safeNumber(i.weighted_average),
            submitted_at: i.submitted_at,
          })).filter(e => e.score !== null),
        };

        const bimbinganTaBreakdown: ScoreBreakdown = {
          score: bimbinganTaItems.length > 0 
            ? bimbinganTaItems.reduce((sum, i) => sum + (safeNumber(i.weighted_average) || 0), 0) / bimbinganTaItems.length 
            : null,
          evaluators: bimbinganTaItems.map(i => ({
            name: i.evaluator.name,
            role: i.evaluator.role,
            score: safeNumber(i.weighted_average),
            submitted_at: i.submitted_at,
          })).filter(e => e.score !== null),
        };

        const sidangTaScores = [
          sidangTaBreakdown.score, 
          bimbinganTaBreakdown.score
        ].filter((s): s is number => s !== null);
        const sidangTaTotal = sidangTaScores.length > 0 ? sidangTaScores.reduce((a, b) => a + b, 0) / sidangTaScores.length : null;

        setSidangTABreakdown({
          sidangTA: sidangTaBreakdown,
          bimbinganTA: bimbinganTaBreakdown,
          total: sidangTaTotal,
        });

        // Calculate final score
        const finalScores = [pdc1Total, pdc2Total, sidangTaTotal].filter((s): s is number => s !== null);
        const finalTotal = finalScores.length > 0 ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length : null;
        setFinalScore(finalTotal);

        // Set status
        const hasAllScores = pdc1Total !== null && pdc2Total !== null && sidangTaTotal !== null;
        setStatus(hasAllScores ? 'COMPLETE' : 'PARTIAL');

      } catch (error) {
        toast.error('Failed to load student grade details');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      fetchData();
    }
  }, [studentId, periodId]);

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

  // Format date - SSR safe
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Render evaluator table
  const EvaluatorTable = ({ breakdown }: { breakdown: ScoreBreakdown }) => {
    if (breakdown.evaluators.length === 0) {
      return <p className="text-muted-foreground text-sm">No evaluations yet</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evaluator</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {breakdown.evaluators.map((evaluator, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{evaluator.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{evaluator.role}</Badge>
              </TableCell>
              <TableCell className={`text-right font-bold ${getScoreColor(evaluator.score)}`}>
                {formatScore(evaluator.score)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(evaluator.submitted_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => router.push('/admin/analytics/grade-check')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Grade Check
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            {studentInfo?.name || 'Student Details'}
          </h1>
          {studentInfo?.nim && (
            <p className="text-muted-foreground mt-1">
              NIM: {studentInfo.nim}
            </p>
          )}
        </div>
        <Badge 
          variant={status === 'COMPLETE' ? 'default' : 'secondary'}
          className={`text-sm px-3 py-1 ${status === 'COMPLETE' 
            ? 'bg-green-100 text-green-800 hover:bg-green-100' 
            : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
          }`}
        >
          {status === 'COMPLETE' ? (
            <><CheckCircle2 className="h-4 w-4 mr-1" /> Complete</>
          ) : (
            <><AlertCircle className="h-4 w-4 mr-1" /> Partial</>
          )}
        </Badge>
      </div>

      {/* Group Info */}
      {groupInfo && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="font-medium">{groupInfo.code}</span>
              <span>-</span>
              <span>{groupInfo.name}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PDC1 Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              PDC1 Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(pdc1Breakdown?.total ?? null)}`}>
              {formatScore(pdc1Breakdown?.total ?? null)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              (SEMPRO + BIMBINGAN_SEMPRO) / 2
            </p>
          </CardContent>
        </Card>

        {/* PDC2 Card */}
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
              <Star className="h-4 w-4" />
              PDC2 Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(pdc2Breakdown?.total ?? null)}`}>
              {formatScore(pdc2Breakdown?.total ?? null)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              (NILAI_DOSEN + MILESTONE + EXPO + PEER_REVIEW) / 4
            </p>
          </CardContent>
        </Card>

        {/* Sidang TA Card */}
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Sidang TA Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(sidangTABreakdown?.total ?? null)}`}>
              {formatScore(sidangTABreakdown?.total ?? null)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              (SIDANG_TA + BIMBINGAN_TA) / 2
            </p>
          </CardContent>
        </Card>

        {/* Final Score Card */}
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Final Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(finalScore)}`}>
              {formatScore(finalScore)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              (PDC1 + PDC2 + Sidang TA) / 3
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Accordion */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detailed Score Breakdown
          </CardTitle>
          <CardDescription>
            View individual evaluator scores for each component
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full" defaultValue={[]}>
            {/* PDC1 Section */}
            <AccordionItem value="pdc1">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">PDC1 Components</div>
                      <div className="text-sm text-muted-foreground">
                        SEMPRO & BIMBINGAN_SEMPRO
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {formatScore(pdc1Breakdown?.total ?? null)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* SEMPRO */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      SEMPRO (Proposal Defense)
                    </h4>
                    {pdc1Breakdown?.sempro && (
                      <EvaluatorTable breakdown={pdc1Breakdown.sempro} />
                    )}
                  </div>
                  <Separator />
                  {/* BIMBINGAN_SEMPRO */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      BIMBINGAN_SEMPRO (Supervision)
                    </h4>
                    {pdc1Breakdown?.bimbinganSempro && (
                      <EvaluatorTable breakdown={pdc1Breakdown.bimbinganSempro} />
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* PDC2 Section */}
            <AccordionItem value="pdc2">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Star className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">PDC2 Components</div>
                      <div className="text-sm text-muted-foreground">
                        NILAI_DOSEN, MILESTONE, EXPO & PEER_REVIEW
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {formatScore(pdc2Breakdown?.total ?? null)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* NILAI_DOSEN */}
                  <div>
                    <h4 className="font-medium mb-2">NILAI_DOSEN (Supervisor Assessment)</h4>
                    {pdc2Breakdown?.nilaiDosen && (
                      <EvaluatorTable breakdown={pdc2Breakdown.nilaiDosen} />
                    )}
                  </div>
                  <Separator />
                  {/* MILESTONE */}
                  <div>
                    <h4 className="font-medium mb-2">MILESTONE</h4>
                    {pdc2Breakdown?.milestone && (
                      <EvaluatorTable breakdown={pdc2Breakdown.milestone} />
                    )}
                  </div>
                  <Separator />
                  {/* EXPO */}
                  <div>
                    <h4 className="font-medium mb-2">EXPO</h4>
                    {pdc2Breakdown?.expo && (
                      <EvaluatorTable breakdown={pdc2Breakdown.expo} />
                    )}
                  </div>
                  <Separator />
                  {/* PEER_REVIEW */}
                  <div>
                    <h4 className="font-medium mb-2">PEER_REVIEW</h4>
                    {pdc2Breakdown?.peerReview && (
                      <EvaluatorTable breakdown={pdc2Breakdown.peerReview} />
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Sidang TA Section */}
            <AccordionItem value="sidang-ta">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <ClipboardCheck className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Sidang TA Components</div>
                      <div className="text-sm text-muted-foreground">
                        SIDANG_TA & BIMBINGAN_TA
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {formatScore(sidangTABreakdown?.total ?? null)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {/* SIDANG_TA */}
                  <div>
                    <h4 className="font-medium mb-2">SIDANG_TA (TA Defense - Examiners)</h4>
                    {sidangTABreakdown?.sidangTA && (
                      <EvaluatorTable breakdown={sidangTABreakdown.sidangTA} />
                    )}
                  </div>
                  <Separator />
                  {/* BIMBINGAN_TA */}
                  <div>
                    <h4 className="font-medium mb-2">BIMBINGAN_TA (TA Supervision)</h4>
                    {sidangTABreakdown?.bimbinganTA && (
                      <EvaluatorTable breakdown={sidangTABreakdown.bimbinganTA} />
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
