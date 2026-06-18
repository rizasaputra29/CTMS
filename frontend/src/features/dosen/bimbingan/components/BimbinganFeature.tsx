'use client';

import { useState, useMemo } from 'react';
import { FileText, Search, Eye, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useBimbingan } from '../hooks/use-bimbingan';
import type { BimbinganDocument } from '../types';

const MAX_FEEDBACK_LENGTH = 500;

export function BimbinganFeature() {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedDoc, setSelectedDoc] = useState<BimbinganDocument | null>(null);
    const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
    const [feedback, setReviewFeedback] = useState('');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [expandedFeedback, setExpandedFeedback] = useState<Record<number, boolean>>({});

    const { periods, groups, documents, isLoading, isRefetching, reviewDocument, isReviewing } = useBimbingan(
        selectedPeriod,
        selectedGroupId
    );

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        setSelectedGroupId('all');
    };

    const handleGroupChange = (val: string) => {
        setSelectedGroupId(val);
    };

    const filteredDocuments = useMemo(() => {
        if (!searchQuery) return documents ?? [];
        const q = searchQuery.toLowerCase();
        return (documents ?? []).filter(
            (doc) =>
                doc.student?.name?.toLowerCase().includes(q) ||
                doc.group?.title?.title?.toLowerCase().includes(q) ||
                doc.phase?.toLowerCase().includes(q)
        );
    }, [documents, searchQuery]);

    const groupedDocuments = useMemo(() => {
        const groupsMap = new Map<number, BimbinganDocument[]>();
        (filteredDocuments ?? []).forEach((doc) => {
            const groupId = doc.group?.id || 0;
            if (!groupsMap.has(groupId)) groupsMap.set(groupId, []);
            groupsMap.get(groupId)!.push(doc);
        });
        return Array.from(groupsMap.values());
    }, [filteredDocuments]);

    const handleReview = (doc: BimbinganDocument) => {
        setSelectedDoc(doc);
        setReviewStatus(doc.status === 'APPROVED' || doc.status === 'REJECTED' ? doc.status : 'APPROVED');
        setReviewFeedback(doc.feedback || '');
        setReviewOpen(true);
    };

    const submitReview = async () => {
        if (!selectedDoc) return;
        await reviewDocument({ docId: selectedDoc.id, status: reviewStatus, feedback });
        setReviewOpen(false);
        setSelectedDoc(null);
        setReviewFeedback('');
    };

    const viewDocument = async (docId: number) => {
        try {
            const response = await api.get(`/dosen/documents/${docId}/download`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], {
                type: String(response.headers['content-type'] || 'application/pdf'),
            });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (error: unknown) {
            const message = await api.getApiErrorMessageAsync(error, 'Failed to view document');
            toast.error(message);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <Badge className="bg-green-500">Approved</Badge>;
            case 'REJECTED':
                return <Badge variant="destructive">Rejected</Badge>;
            case 'SUBMITTED':
                return <Badge className="bg-blue-500">Submitted</Badge>;
            default:
                return <Badge variant="secondary">Draft</Badge>;
        }
    };

    if (isLoading) return <Loading variant="section" />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Guidance & Reviews</h1>
                    <p className="text-muted-foreground">Review student documents and provide feedback.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map((p) => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && '(Active)'}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Filter by Group" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Groups</SelectItem>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                    {group.title?.title || group.code || `Group ${group.id}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isRefetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by student, title, or phase..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <p className="font-medium">No supervised groups found</p>
                    <p className="text-sm mt-1">You are not assigned as a supervisor (Dosbing 1 or Dosbing 2) for any group in this period.</p>
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">No submissions found.</div>
            ) : (
                <div className="space-y-6">
                    {groupedDocuments.map((groupDocs, index) => {
                        const firstDoc = groupDocs[0];
                        const groupId = firstDoc?.group?.id;
                        const groupInfo = groups.find((g) => g.id === groupId);
                        const groupTitle = firstDoc?.group?.title?.title || `Group ${groupId || 'Unknown'}`;

                        return (
                            <Card key={groupId || index} className="overflow-hidden">
                                <div className="bg-muted/40 border-b px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold tracking-tight text-foreground">{groupTitle}</h2>
                                        {groupInfo?.is_dosbing_1 && <Badge className="bg-blue-500">Dosbing 1</Badge>}
                                        {groupInfo?.is_dosbing_2 && <Badge className="bg-green-500">Dosbing 2</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {groupDocs.length} Submission{groupDocs.length !== 1 ? 's' : ''} Documented
                                    </p>
                                </div>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-border">
                                        {groupDocs.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between hover:bg-muted/20 transition-colors"
                                            >
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <FileText className="h-4 w-4 text-primary" />
                                                        <span className="font-semibold text-base">
                                                            {doc.phase} {doc.document_type && doc.document_type !== 'GENERAL' ? `- ${doc.document_type}` : ''}
                                                        </span>
                                                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">v{doc.version}</span>
                                                        {getStatusBadge(doc.status)}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <span>
                                                            By <span className="font-medium text-foreground">{doc.student?.name}</span>
                                                        </span>
                                                        <span>&bull;</span>
                                                        <span>
                                                             {formatDateTime(doc.created_at)}
                                                         </span>
                                                    </div>
                                                    {doc.feedback && (
                                                        <div className="mt-3 text-sm bg-orange-500/10 text-orange-700 dark:text-orange-400 p-3 rounded-md border border-orange-500/20 max-w-3xl">
                                                            <span className="font-semibold block mb-1">Latest Feedback:</span>
                                                            <div className="whitespace-pre-wrap">
                                                                {doc.feedback.length > 150 && !expandedFeedback[doc.id] ? (
                                                                    <>
                                                                        {doc.feedback.slice(0, 150)}...
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setExpandedFeedback((prev) => ({ ...prev, [doc.id]: true }));
                                                                            }}
                                                                            className="text-orange-600 hover:text-orange-800 underline ml-1 font-medium"
                                                                        >
                                                                            Show more
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {doc.feedback}
                                                                        {doc.feedback.length > 150 && expandedFeedback[doc.id] && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setExpandedFeedback((prev) => ({ ...prev, [doc.id]: false }));
                                                                                }}
                                                                                className="text-orange-600 hover:text-orange-800 underline ml-1 font-medium"
                                                                            >
                                                                                Show less
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => viewDocument(doc.id)}>
                                                        <Eye className="mr-2 h-4 w-4" /> View
                                                    </Button>
                                                    <Button size="sm" className="w-full sm:w-auto" onClick={() => handleReview(doc)}>
                                                        Review
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review Document</DialogTitle>
                        <DialogDescription>Provide feedback and update status for {selectedDoc?.phase}.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={reviewStatus} onValueChange={(val: 'APPROVED' | 'REJECTED') => setReviewStatus(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="APPROVED">Approve</SelectItem>
                                    <SelectItem value="REJECTED">Reject / Revise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex justify-between items-center">
                                <Label>Feedback</Label>
                                <span className={`text-xs ${feedback.length > MAX_FEEDBACK_LENGTH ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {feedback.length}/{MAX_FEEDBACK_LENGTH}
                                </span>
                            </div>
                            <Textarea
                                value={feedback}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_FEEDBACK_LENGTH) {
                                        setReviewFeedback(e.target.value);
                                    }
                                }}
                                placeholder="Enter your feedback here..."
                                rows={4}
                                maxLength={MAX_FEEDBACK_LENGTH}
                                className={feedback.length > MAX_FEEDBACK_LENGTH ? 'border-red-500 focus-visible:ring-red-500' : ''}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={submitReview} disabled={isReviewing}>
                            {isReviewing ? 'Saving...' : 'Save Review'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
