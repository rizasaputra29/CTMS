'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, User, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';

interface GroupMember { id: number; student: { id: number; name: string; email: string }; is_leader: boolean; }
interface Indicator { id: number; name: string; description: string | null; weight: number; }
interface ExistingReview { reviewee_id: number; indicator_id: number; score: number; comment: string | null; }

export default function MahasiswaPeerReviewPage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [indicators, setIndicators] = useState<Indicator[]>([]);
    const [existingReviews, setExistingReviews] = useState<ExistingReview[]>([]);
    const [currentUser, setCurrentUser] = useState<number | null>(null);
    const [hasGroup, setHasGroup] = useState(true);
    const [isLocked, setIsLocked] = useState(false);

    // scores[reviewee_id][indicator_id] = { score, comment }
    const [scores, setScores] = useState<Record<number, Record<number, { score: number; comment: string }>>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/mahasiswa/peer-review');
            setMembers(res.data.members || []);
            setIndicators(res.data.indicators || []);
            setExistingReviews(res.data.reviews || []);
            setCurrentUser(res.data.current_user_id || null);
            setIsLocked(res.data.is_locked || false);
            setHasGroup(true);

            // Initialize scores from existing reviews
            const initial: typeof scores = {};
            for (const m of (res.data.members || [])) {
                if (m.student.id === res.data.current_user_id) continue;
                initial[m.student.id] = {};
                for (const ind of (res.data.indicators || [])) {
                    const existing = (res.data.reviews || []).find(
                        (r: ExistingReview) => r.reviewee_id === m.student.id && r.indicator_id === ind.id
                    );
                    initial[m.student.id][ind.id] = {
                        score: existing?.score ?? 75,
                        comment: existing?.comment ?? '',
                    };
                }
            }
            setScores(initial);
        } catch {
            setHasGroup(false);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const updateScore = (revieweeId: number, indicatorId: number, score: number) => {
        setScores(prev => ({
            ...prev,
            [revieweeId]: { ...prev[revieweeId], [indicatorId]: { ...prev[revieweeId][indicatorId], score } },
        }));
    };

    const updateComment = (revieweeId: number, indicatorId: number, comment: string) => {
        setScores(prev => ({
            ...prev,
            [revieweeId]: { ...prev[revieweeId], [indicatorId]: { ...prev[revieweeId][indicatorId], comment } },
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const reviews: { reviewee_id: number; indicator_id: number; score: number; comment: string }[] = [];
            for (const [revieweeId, indicators] of Object.entries(scores)) {
                for (const [indicatorId, data] of Object.entries(indicators)) {
                    reviews.push({
                        reviewee_id: parseInt(revieweeId),
                        indicator_id: parseInt(indicatorId),
                        score: data.score,
                        comment: data.comment,
                    });
                }
            }
            await api.post('/mahasiswa/peer-review', { reviews });
            toast.success('Peer review submitted successfully!');
            fetchData();
        } catch {
            toast.error('Failed to submit peer review');
        } finally { setSubmitting(false); }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    if (!hasGroup) {
        return (
            <div className="space-y-6">
                <div><h1 className="text-3xl font-bold tracking-tight">Peer Review</h1><p className="text-muted-foreground">Evaluate your group members.</p></div>
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h2 className="text-xl font-bold mb-2">No Group</h2>
                    <p>You need to be in a group to submit peer reviews.</p>
                </div>
            </div>
        );
    }
    
    if (isLocked) {
        return (
            <div className="space-y-6">
                <div><h1 className="text-3xl font-bold tracking-tight">Peer Review</h1><p className="text-muted-foreground">Evaluate your group members.</p></div>
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground bg-white">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h2 className="text-xl font-bold mb-2 text-foreground">Peer Review Locked</h2>
                    <p>Peer review is locked until your group reaches the <span className="font-semibold">Expo Stage</span>.</p>
                </div>
            </div>
        );
    }

    const reviewableMembers = members.filter(m => m.student.id !== currentUser);
    const hasExisting = existingReviews.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Peer Review</h1>
                    <p className="text-muted-foreground">
                        {indicators.length > 0 ? (
                            <>
                                Rate each group member on {indicators.length} indicator{indicators.length !== 1 ? 's' : ''}.
                                {hasExisting && <Badge variant="outline" className="ml-2">Already submitted — edit to update</Badge>}
                            </>
                        ) : 'Peer review configuration pending.'}
                    </p>
                </div>
                {indicators.length > 0 && reviewableMembers.length > 0 && (
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        {hasExisting ? 'Update Reviews' : 'Submit Reviews'}
                    </Button>
                )}
            </div>

            {indicators.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground bg-muted/20">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-30 gap-2" />
                    <h2 className="text-lg text-foreground font-semibold mb-2">Not Yet Available</h2>
                    <p>No peer review indicators have been set up for this period.<br/>Please wait for your admin to configure them.</p>
                </div>
            ) : reviewableMembers.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                    No other group members to review.
                </div>
            ) : (
                <div className="space-y-6">
                    {reviewableMembers.map(member => (
                        <Card key={member.student.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{member.student.name}</CardTitle>
                                        <CardDescription>{member.student.email} {member.is_leader && <Badge variant="outline" className="ml-1 text-xs">Leader</Badge>}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {indicators.map(ind => {
                                    const current = scores[member.student.id]?.[ind.id];
                                    return (
                                        <div key={ind.id} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-medium">{ind.name} <span className="text-muted-foreground font-normal">({ind.weight}%)</span></Label>
                                                <Badge variant="secondary">{current?.score ?? 75}</Badge>
                                            </div>
                                            {ind.description && <p className="text-xs text-muted-foreground">{ind.description}</p>}
                                            <Slider
                                                value={[current?.score ?? 75]}
                                                onValueChange={([v]: number[]) => updateScore(member.student.id, ind.id, v)}
                                                min={0} max={100} step={5}
                                                className="my-2"
                                            />
                                            <Textarea
                                                value={current?.comment ?? ''}
                                                onChange={e => updateComment(member.student.id, ind.id, e.target.value)}
                                                placeholder="Optional comment..."
                                                className="text-sm"
                                                rows={2}
                                            />
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
