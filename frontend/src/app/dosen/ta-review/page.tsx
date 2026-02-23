'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileCheck, CheckCircle2, RotateCcw, ShieldCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

interface TaSubmission {
    id: number;
    student_id: number;
    group_id: number;
    status: string;
    file_path: string | null;
    feedback: string | null;
    student: { name: string; email: string } | null;
    group: {
        title: { title: string } | null;
    } | null;
}

const STATUS_LABELS: Record<string, string> = {
    TA_LOCKED: 'Locked',
    TA_DRAFT: 'Draft',
    TA_REVISED: 'Revised',
    TA_READY: 'Ready',
    TA_REGISTERED: 'Registered',
    TA_DEFENDED: 'Defended',
};

export default function DosenTaReviewPage() {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState<TaSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<TaSubmission | null>(null);
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchSubmissions = useCallback(async () => {
        try {
            // Get supervised groups then their TA submissions
            const groupRes = await api.get('/dosen/groups/supervised');
            const groups = groupRes.data.data || [];

            // For each group, fetch TA submissions
            const allSubs: TaSubmission[] = [];
            for (const group of groups) {
                try {
                    const taRes = await api.get(`/dosen/documents?group_id=${group.id}`);
                    // Combine with any TA submission data
                    if (group.ta_submissions) {
                        allSubs.push(...group.ta_submissions.map((s: TaSubmission) => ({
                            ...s,
                            group: { title: group.title },
                        })));
                    }
                } catch {
                    // Skip errors for individual groups
                }
            }
            setSubmissions(allSubs);
        } catch (err) {
            console.error('Failed to fetch TA submissions', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const handleReview = async (result: 'APPROVE' | 'REVISE') => {
        if (!selectedSub) return;
        setSubmitting(true);
        try {
            await api.put(`/dosen/ta/${selectedSub.id}/review`, {
                result,
                feedback,
            });
            toast.success(`TA review: ${result}`);
            setReviewOpen(false);
            setSelectedSub(null);
            setFeedback('');
            fetchSubmissions();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Review failed');
            else toast.error('Review failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDefended = async (subId: number) => {
        if (!confirm('Mark this TA as defended? This action is final.')) return;
        try {
            await api.put(`/dosen/ta/${subId}/defended`);
            toast.success('TA marked as defended.');
            fetchSubmissions();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Failed');
            else toast.error('Failed to mark as defended');
        }
    };

    const openReview = (sub: TaSubmission) => {
        setSelectedSub(sub);
        setFeedback('');
        setReviewOpen(true);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">TA Review</h1>
                <p className="text-muted-foreground">Review student TA drafts and mark defenses.</p>
            </div>

            {submissions.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                    <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h2 className="text-xl font-bold mb-2">No TA Submissions</h2>
                    <p className="text-muted-foreground">TA submissions from your supervised groups will appear here.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {submissions.map((sub) => (
                        <Card key={sub.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{sub.student?.name || `Student #${sub.student_id}`}</CardTitle>
                                        <CardDescription>{sub.group?.title?.title || `Group #${sub.group_id}`}</CardDescription>
                                    </div>
                                    <Badge variant={sub.status === 'TA_DEFENDED' ? 'default' : 'secondary'}>
                                        {STATUS_LABELS[sub.status] || sub.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {sub.file_path && (
                                    <div className="text-sm">
                                        <span className="font-medium">File:</span>
                                        <span className="text-muted-foreground ml-2">{sub.file_path}</span>
                                    </div>
                                )}
                                {sub.feedback && (
                                    <div className="text-sm mt-2">
                                        <span className="font-medium">Last feedback:</span>
                                        <span className="text-muted-foreground ml-2">{sub.feedback}</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t pt-3 gap-2">
                                {['TA_DRAFT', 'TA_REVISED'].includes(sub.status) && (
                                    <Button size="sm" onClick={() => openReview(sub)}>
                                        <FileCheck className="mr-1 h-3 w-3" /> Review
                                    </Button>
                                )}
                                {sub.status === 'TA_REGISTERED' && (
                                    <Button size="sm" variant="default" onClick={() => handleDefended(sub.id)}>
                                        <ShieldCheck className="mr-1 h-3 w-3" /> Mark Defended
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Review Dialog */}
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review TA Submission</DialogTitle>
                        <DialogDescription>
                            Approve the submission or request revisions with feedback.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {selectedSub?.file_path && (
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                <span className="font-medium">File:</span> {selectedSub.file_path}
                            </div>
                        )}
                        <div>
                            <Label>Feedback (optional for approve, recommended for revision)</Label>
                            <Textarea
                                placeholder="Write your feedback here..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
                        <Button
                            variant="outline"
                            className="text-amber-600 border-amber-300"
                            onClick={() => handleReview('REVISE')}
                            disabled={submitting}
                        >
                            <RotateCcw className="mr-1 h-3 w-3" /> Request Revision
                        </Button>
                        <Button onClick={() => handleReview('APPROVE')} disabled={submitting}>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
