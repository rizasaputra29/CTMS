'use client';

import { FileCheck, CheckCircle2, RotateCcw, ShieldCheck, CalendarDays, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useTaReview } from '../hooks/use-ta-review';

const STATUS_LABELS: Record<string, string> = {
    TA_LOCKED: 'Locked',
    TA_DRAFT: 'Draft',
    TA_REVISED: 'Revised',
    TA_READY: 'Ready',
    TA_REGISTERED: 'Registered',
    TA_DEFENDED: 'Defended',
};

export function TaReviewFeature() {
    const {
        filteredSubmissions,
        loading,
        periods,
        selectedPeriod,
        periodLoading,
        reviewOpen,
        selectedSub,
        feedback,
        submitting,
        searchQuery,
        setSearchQuery,
        setSelectedPeriod,
        setReviewOpen,
        setFeedback,
        setSelectedSub,
        handleReview,
        handleDefended,
        openReview,
    } = useTaReview();

    if (loading) return <Loading variant="section" />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="TA Review"
                description="Review student TA drafts and mark defenses."
            />

            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Academic Period:</span>
                </div>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[200px] h-9">
                        <SelectValue placeholder="Select Period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        {periods.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} {p.is_active && '(Active)'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {periodLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by student or title..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>

            {filteredSubmissions.length === 0 ? (
                <EmptyState
                    icon={FileCheck}
                    title={searchQuery ? 'No matching submissions found' : 'No TA Submissions'}
                    description={searchQuery ? 'Try adjusting your search query.' : 'TA submissions from your supervised groups will appear here.'}
                />
            ) : (
                <div className="grid gap-4">
                    {filteredSubmissions.map((sub) => (
                        <Card key={sub.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{sub.student?.name || `Student #${sub.student_id}`}</CardTitle>
                                        <CardDescription>{sub.group?.title?.title || `Group ${sub.group_id}`}</CardDescription>
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

            <Dialog open={reviewOpen} onOpenChange={(open) => {
                setReviewOpen(open);
                if (!open) setSelectedSub(null);
            }}>
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
