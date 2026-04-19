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
    const [myStatus, setMyStatus] = useState<{ has_completed: boolean; ta_status: string; can_access_ta: boolean; expo_done: boolean } | null>(null);

    // scores[reviewee_id][indicator_id] = { score, comment }
    const [scores, setScores] = useState<Record<number, Record<number, { score: number; comment: string }>>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch peer review form data and my status in parallel
            const [formRes, statusRes] = await Promise.all([
                api.get('/mahasiswa/peer-review'),
                api.get('/mahasiswa/peer-review/my-status')
            ]);
            
            setMembers(formRes.data.members || []);
            setIndicators(formRes.data.indicators || []);
            setExistingReviews(formRes.data.reviews || []);
            setCurrentUser(formRes.data.current_user_id || null);
            setIsLocked(formRes.data.is_locked || false);
            setHasGroup(true);
            setMyStatus(statusRes.data);

            // Initialize scores from existing reviews
            const initial: typeof scores = {};
            for (const m of (formRes.data.members || [])) {
                if (m.student.id === formRes.data.current_user_id) continue;
                initial[m.student.id] = {};
                for (const ind of (formRes.data.indicators || [])) {
                    const existing = (formRes.data.reviews || []).find(
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
                    <p>Peer review will unlock after <span className="font-semibold">EXPO is completed</span>.</p>
                    {myStatus && !myStatus.expo_done && (
                        <p className="mt-2 text-sm">Your group is currently participating in EXPO. Please wait until EXPO is finished.</p>
                    )}
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

            {/* TA Status Section - Show after peer review completion */}
            {myStatus?.has_completed && (
                <Card className="mt-6 border-green-200 bg-green-50">
                    <CardHeader>
                        <CardTitle className="text-green-800">Peer Review Completed!</CardTitle>
                        <CardDescription className="text-green-700">
                            You have successfully completed peer review for all group members.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-green-800">
                                    TA Status: {myStatus.ta_status === 'TA_ACTIVE' ? 'Active' : myStatus.ta_status === 'TA_DONE' ? 'Completed' : 'Blocked'}
                                </p>
                                <p className="text-sm text-green-700 mt-1">
                                    {myStatus.can_access_ta 
                                        ? 'You can now access the TA phase. Upload your documents and schedule your defense.' 
                                        : 'TA access will be granted shortly.'}
                                </p>
                            </div>
                            {myStatus.can_access_ta && (
                                <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-100" onClick={() => window.location.href = '/mahasiswa/ta'}>
                                    Go to TA Phase
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
