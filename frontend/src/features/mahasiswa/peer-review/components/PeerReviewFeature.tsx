'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loading } from '@/components/ui/loading';
import {
  Star,
  Send,
  Lock,
  CheckCircle2,
  Users,
  Info,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage, isAxiosError } from '@/lib/error-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GroupMember, Indicator, ExistingReview } from '../types';

export function PeerReviewFeature() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [currentUser, setCurrentUser] = useState<number | null>(null);
  const [hasGroup, setHasGroup] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [myStatus, setMyStatus] = useState<{ has_completed: boolean; ta_status: string; can_access_ta: boolean; expo_done: boolean } | null>(null);
  const [groupInfo, setGroupInfo] = useState<{ name?: string; code?: string; title?: { name: string } } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // scores[reviewee_id][period_indicator_id] = { score, comment }
  const [scores, setScores] = useState<Record<number, Record<number, { score: number; comment: string }>>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const [formRes, statusRes] = await Promise.all([
        api.get('/mahasiswa/peer-review'),
        api.get('/mahasiswa/peer-review/my-status')
      ]);

      const formData = formRes.data?.data ?? formRes.data;
      const statusData = statusRes.data?.data ?? statusRes.data;

      setMembers(formData?.members ?? []);
      setIndicators(formData?.indicators ?? []);
      setCurrentUser(formData?.current_user_id ?? null);
      setIsLocked(formData?.is_locked ?? false);
      setHasSubmitted(formData?.has_submitted ?? false);
      setHasGroup(true);
      setMyStatus(statusData);

      if (formData?.group) {
        setGroupInfo({
          name: formData.group.name,
          code: formData.group.code || `Group ${formData.group.id}`,
          title: formData.group.title,
        });
      }

      // Initialize scores from existing reviews
      const initial: typeof scores = {};
      for (const m of (formData?.members ?? [])) {
        if (m.student.id === formData?.current_user_id) continue;
        initial[m.student.id] = {};
        for (const ind of (formData?.indicators ?? [])) {
          const existing = (formData?.existing_reviews ?? []).find(
            (r: ExistingReview) => r.reviewee_id === m.student.id && r.period_indicator_id === ind.id
          );
          initial[m.student.id][ind.id] = {
            score: existing?.raw_score ?? existing?.score ?? 0,
            comment: existing?.comment ?? '',
          };
        }
      }
      setScores(initial);
    } catch (error: unknown) {
      console.error('Peer review fetch error:', error);
      const errorMessage = getApiErrorMessage(error);
      const axiosError = isAxiosError(error) ? error : null;

      if (axiosError?.response?.status === 404 &&
        axiosError?.response?.data?.message?.includes('not in any group')) {
        setHasGroup(false);
      } else {
        setHasGroup(true);
        toast.error('Failed to load peer review data: ' + errorMessage);
      }
    } finally { 
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateScore = (revieweeId: number, periodIndicatorId: number, score: number) => {
    setScores(prev => ({
      ...prev,
      [revieweeId]: { ...prev[revieweeId], [periodIndicatorId]: { ...prev[revieweeId][periodIndicatorId], score } },
    }));
  };

  const updateComment = (revieweeId: number, periodIndicatorId: number, comment: string) => {
    setScores(prev => ({
      ...prev,
      [revieweeId]: { ...prev[revieweeId], [periodIndicatorId]: { ...prev[revieweeId][periodIndicatorId], comment } },
    }));
  };

  const handleOpenConfirm = () => {
    if (hasSubmitted) {
      toast.error('You have already submitted your peer reviews.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleCloseConfirm = () => {
    setShowConfirmModal(false);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const reviews: { reviewee_id: number; period_indicator_id: number; score: number; comment: string }[] = [];
      for (const [revieweeId, indicatorsMap] of Object.entries(scores)) {
        for (const [periodIndicatorId, data] of Object.entries(indicatorsMap)) {
          reviews.push({
            reviewee_id: parseInt(revieweeId),
            period_indicator_id: parseInt(periodIndicatorId),
            score: data.score,
            comment: data.comment,
          });
        }
      }
      await api.post('/mahasiswa/peer-review', { reviews });
      toast.success('Peer review submitted successfully!');
      await fetchData();
    } catch (error: unknown) {
      console.error('Peer review submit error:', error);
      toast.error('Failed to submit peer review: ' + getApiErrorMessage(error));
    } finally { setSubmitting(false); }
  };

  // Conversion formula: 1-4 scale -> 0-100 scale (score * 25, or score * 10/4)
  const convertScoreTo100 = (score: number): number => {
    return score > 0 ? score * 25 : 0;
  };

  const calculateWeightedAvg = (revieweeId: number) => {
    let totalWeighted = 0;
    let totalWeight = 0;
    for (const ind of indicators) {
      const s = scores[revieweeId]?.[ind.id];
      if (s && s.score > 0) {
        const weight = Number(ind.weight) || 0;
        // Convert 1-4 scale to 0-100 scale before calculating weighted average
        const scoreIn100Scale = convertScoreTo100(Number(s.score));
        totalWeighted += scoreIn100Scale * weight;
        totalWeight += weight;
      }
    }
    return totalWeight > 0 ? (totalWeighted / totalWeight).toFixed(1) : '0.0';
  };

  const reviewableMembers = (members ?? []).filter(m => m.student.id !== currentUser);

  const calculateTotalWeightedAvg = () => {
    let totalScore = 0;
    let count = 0;
    for (const member of reviewableMembers) {
      const avg = parseFloat(calculateWeightedAvg(member.student.id));
      if (!isNaN(avg)) {
        totalScore += avg;
        count++;
      }
    }
    return count > 0 ? (totalScore / count).toFixed(1) : '0.0';
  };

  // ── Loading skeleton ──
  if (loading) return <Loading variant="section" />;

  // ── No group ──
  if (!hasGroup) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Peer Review</h1><p className="text-muted-foreground">Evaluate your group members.</p></div>
        <div className="text-center py-16 border rounded-lg border-dashed text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold mb-2">No Group</h2>
          <p>You need to be in a group to submit peer reviews.</p>
        </div>
      </div>
    );
  }

  // ── Locked (EXPO not registered) ──
  if (isLocked) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Peer Review</h1><p className="text-muted-foreground">Evaluate your group members.</p></div>
        <div className="text-center py-16 border rounded-lg border-dashed text-muted-foreground bg-white">
          <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold mb-2 text-foreground">Peer Review Locked</h2>
          <p>Peer review will unlock once your group is <span className="font-semibold">registered for EXPO</span>.</p>
          <p className="mt-2 text-sm">Please register your group for an EXPO event first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Peer Review</h1>
          <p className="text-muted-foreground">
            {indicators.length > 0 ? (
              <>
                Rate each group member on {indicators.length} indicator{indicators.length !== 1 ? 's' : ''}
                {hasSubmitted && (
                  <Badge variant="secondary" className="ml-2 border-green-300 text-green-700 bg-green-50">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Submitted
                  </Badge>
                )}
              </>
            ) : 'Peer review configuration pending.'}
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          Mahasiswa
        </Badge>
      </div>

      {/* ── No indicators ── */}
      {indicators.length === 0 ? (
        <div className="text-center py-16 border rounded-lg border-dashed text-muted-foreground bg-muted/20">
          <Star className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <h2 className="text-lg text-foreground font-semibold mb-2">Not Yet Available</h2>
          <p>No peer review indicators have been set up for this period.<br />Please wait for your admin to configure them.</p>
        </div>
      ) : reviewableMembers.length === 0 ? (
        <div className="text-center py-16 border rounded-lg border-dashed text-muted-foreground">
          No other group members to review.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Left Column: Group Info ── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Group Info Card */}
            <Card className="border-primary/20 shadow-lg overflow-hidden">
              <div className="h-2 bg-primary" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Group Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                  {groupInfo?.title && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase font-semibold">Project Title</Label>
                      <p className="font-medium text-sm leading-tight text-primary">{groupInfo.title.name}</p>
                    </div>
                  )}
                  {groupInfo?.title && <Separator className="bg-primary/10" />}
                  {groupInfo?.code && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase font-semibold">Group Code</Label>
                      <p className="font-medium">{groupInfo.code}</p>
                    </div>
                  )}
                  <Separator className="bg-primary/10" />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-semibold">Members</Label>
                    {(members ?? []).map((member) => (
                      <div key={member.student.id} className="flex items-center gap-3 bg-background p-2 rounded-lg border border-primary/5 shadow-sm">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {member.student.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {member.student.name}
                            {member.student.id === currentUser && (
                              <span className="text-muted-foreground font-normal"> (You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.student.nim || member.student.email}</p>
                        </div>
                        {member.is_leader && (
                          <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                            Leader
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-primary/10 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Scoring Guide
                </CardTitle>
                <CardDescription>How to evaluate your peers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">Scale: 1 (Worst) – 4 (Best)</p>
                  <div className="grid grid-cols-2 gap-2 text-xs pl-2">
                    <span className="text-red-600">1 = Poor</span>
                    <span className="text-orange-600">2 = Fair</span>
                    <span className="text-blue-600">3 = Good</span>
                    <span className="text-green-600">4 = Excellent</span>
                  </div>
                  <Separator />
                  <p>• Each indicator has a specific weight</p>
                  <p>• Weighted average is calculated automatically</p>
                  <p>• Scores are converted to 0-100 scale for reports</p>
                  <p>• Comments are optional but encouraged</p>
                </div>
                {hasSubmitted && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>
                        Your reviews have been <strong>submitted</strong>. You can view your scores but cannot make changes.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right Column: Assessment Rubric ── */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="shadow-xl">
              <CardHeader className="bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{hasSubmitted ? 'Submitted Peer Review' : 'Assessment Rubric'}</CardTitle>
                    <CardDescription>
                      {hasSubmitted
                        ? 'Your submitted scores (read-only)'
                        : 'Enter scores (1-4) for each member and indicator'}
                    </CardDescription>
                  </div>
                  {hasSubmitted && (
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      <Lock className="mr-1 h-3 w-3" /> Locked
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {hasSubmitted ? (
                  // View-Only Table After Submission
                  <div className="p-6">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Member</th>
                            {indicators.map(ind => (
                              <th key={ind.id} className="px-4 py-3 text-center font-semibold">
                                <div className="flex flex-col items-center">
                                  <span>{ind.code}</span>
                                  <span className="text-xs text-muted-foreground">({ind.weight}%)</span>
                                </div>
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center font-semibold">
                              <div className="flex flex-col items-center">
                                <span>Weighted Avg</span>
                                <span className="text-xs text-muted-foreground">(0-100 scale)</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {reviewableMembers.map(member => (
                            <tr key={member.student.id} className="hover:bg-muted/20">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                    {member.student.name.charAt(0)}
                                  </span>
                                  <span className="font-medium">{member.student.name}</span>
                                  {member.is_leader && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">Leader</Badge>
                                  )}
                                </div>
                              </td>
                              {indicators.map(ind => {
                                const score = scores[member.student.id]?.[ind.id]?.score ?? 0;
                                const convertedScore = score > 0 ? (score * 25).toFixed(0) : 0;
                                return (
                                  <td key={ind.id} className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center">
                                      <span className={`font-bold ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {score > 0 ? score : '-'}
                                      </span>
                                      {score > 0 && (
                                        <span className="text-xs text-muted-foreground">({convertedScore})</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center">
                                <span className="font-bold text-primary text-lg">
                                  {calculateWeightedAvg(member.student.id)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Scores shown in 1-4 scale with converted 0-100 values in parentheses
                    </p>
                  </div>
                ) : (
                  // Editable Form Before Submission
                  <div className="divide-y divide-border">
                    {indicators.map((ind) => (
                      <div key={ind.id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors">
                        {/* Indicator header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">{ind.code}</span>
                              <h3 className="font-bold text-lg">{ind.name}</h3>
                            </div>
                            {ind.description && (
                              <p className="text-sm text-muted-foreground">{ind.description}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Weight</p>
                            <p className="text-lg font-extrabold text-primary">{ind.weight}%</p>
                          </div>
                        </div>

                        {/* Scores per reviewable member */}
                        <div className="grid grid-cols-1 gap-4 mt-4">
                          {reviewableMembers.map((member) => {
                            const current = scores[member.student.id]?.[ind.id];
                            const scoreVal = current?.score ?? 0;
                            return (
                              <div key={member.student.id} className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border/50">
                                <div className="flex items-center justify-between gap-2">
                                  <Label className="text-xs flex items-center gap-2 flex-1">
                                    <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                      {member.student.name.charAt(0)}
                                    </span>
                                    <span className="flex-1">{member.student.name}</span>
                                    {member.is_leader && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">Leader</Badge>
                                    )}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Score:</span>
                                    <Select
                                      value={scoreVal > 0 ? scoreVal.toString() : ''}
                                      onValueChange={(val) => {
                                        const numVal = parseInt(val);
                                        if (numVal >= 1 && numVal <= 4) {
                                          updateScore(member.student.id, ind.id, numVal);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-20 h-8 text-center text-sm">
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">1</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                        <SelectItem value="3">3</SelectItem>
                                        <SelectItem value="4">4</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Textarea
                                  value={current?.comment ?? ''}
                                  onChange={e => updateComment(member.student.id, ind.id, e.target.value)}
                                  placeholder='Feedback (optional)...'
                                  className="h-10 min-h-[40px] text-sm py-2"
                                  rows={1}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Summary Card ── */}
            <Card className="border-primary shadow-lg bg-primary/5">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2">
                    <h4 className="font-bold text-muted-foreground">Score Summary</h4>
                    {isRefreshing ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span className="text-sm">Refreshing scores...</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 flex-wrap">
                        {reviewableMembers.map(member => (
                          <div key={member.student.id} className="text-center">
                            <p className="text-xs text-muted-foreground">{member.student.name.split(' ')[0]}</p>
                            <p className="text-2xl font-black text-primary">{calculateWeightedAvg(member.student.id)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {!hasSubmitted ? (
                      <Button
                        size="lg"
                        className="px-8 font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                        onClick={handleOpenConfirm}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Submit Reviews
                            <Send className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-semibold">Submitted</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Peer Review Submission
            </DialogTitle>
            <DialogDescription>
              Please review your scores carefully. Once submitted, you cannot make changes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Summary Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Member</th>
                    {indicators.map(ind => (
                      <th key={ind.id} className="px-4 py-2 text-center font-semibold">
                        {ind.code}
                        <span className="block text-xs font-normal text-muted-foreground">({ind.weight}%)</span>
                      </th>
                    ))}
                    <th className="px-4 py-2 text-center font-semibold">
                      Weighted Avg
                      <span className="block text-xs font-normal text-muted-foreground">(0-100)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reviewableMembers.map(member => (
                    <tr key={member.student.id}>
                      <td className="px-4 py-3 font-medium">{member.student.name}</td>
                      {indicators.map(ind => {
                        const score = scores[member.student.id]?.[ind.id]?.score ?? 0;
                        const convertedScore = score > 0 ? (score * 25) : 0;
                        return (
                          <td key={ind.id} className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-bold ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-amber-600' : 'text-red-600'}`}>
                                {score > 0 ? score : '-'}
                              </span>
                              {score > 0 && (
                                <span className="text-xs text-muted-foreground">({convertedScore})</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-primary text-lg">
                          {calculateWeightedAvg(member.student.id)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Overall Average */}
            <div className="bg-primary/5 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Overall Average Score (0-100 scale)</p>
              <p className="text-3xl font-black text-primary">{calculateTotalWeightedAvg()}</p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">This action cannot be undone</p>
                <p className="text-red-700">
                  Once you submit your peer reviews, you will not be able to edit them. 
                  Please verify all scores are correct before confirming.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseConfirm}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Confirm Submission
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TA Status Banner ── */}
      {myStatus?.has_completed && (
        <Card className="border-green-200 bg-green-50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h4 className="font-bold text-green-800">Peer Review Completed!</h4>
                  <p className="text-sm text-green-700">
                    TA Status: <strong>{myStatus.ta_status === 'TA_ACTIVE' ? 'Active' : myStatus.ta_status === 'TA_DONE' ? 'Completed' : 'Blocked'}</strong>
                    {' — '}
                    {myStatus.can_access_ta
                      ? 'You can now access the TA phase.'
                      : 'TA access will be granted shortly.'}
                  </p>
                </div>
              </div>
              {myStatus.can_access_ta && (
                <Button
                  variant="outline"
                  className="border-green-600 text-green-700 hover:bg-green-100 font-bold"
                  onClick={() => window.location.href = '/mahasiswa/ta-submission'}
                >
                  Go to TA Phase
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
