'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea"
import { FileText, Download, Filter } from 'lucide-react';
import { toast } from "sonner";

interface Document {
    id: number;
    phase: string;
    file_path: string;
    version: number;
    document_type?: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    feedback: string | null;
    created_at: string;
    student: {
        name: string;
    } | null;
    group: {
        id: number;
        title: {
            title: string;
        } | null;
    } | null;
}

interface Group {
    id: number;
    title: {
        title: string;
    };
    members: {
        student: {
            name: string;
        };
    }[];
}


export default function DosenBimbinganPage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
    const [loading, setLoading] = useState(false);

    // Review State
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
    const [feedback, setReviewFeedback] = useState('');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await api.get('/dosen/groups/supervised');
                setGroups(response.data.data);
            } catch (error) {
                console.error('Failed to fetch groups', error);
                toast.error('Failed to load supervised groups');
            }
        };
        fetchGroups();
    }, []);

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const params = selectedGroupId !== 'all' ? { group_id: selectedGroupId } : {};
            const response = await api.get('/dosen/documents', { params });
            setDocuments(response.data.data);
        } catch (error) {
            console.error('Failed to fetch documents', error);
        } finally {
            setLoading(false);
        }
    }, [selectedGroupId]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const groupedDocuments = useMemo(() => {
        const groupsMap = new Map<number, Document[]>();
        documents.forEach(doc => {
            const groupId = doc.group?.id || 0;
            if (!groupsMap.has(groupId)) {
                groupsMap.set(groupId, []);
            }
            groupsMap.get(groupId)!.push(doc);
        });
        return Array.from(groupsMap.values());
    }, [documents]);

    const handleReview = (doc: Document) => {
        setSelectedDoc(doc);
        setReviewStatus(doc.status === 'APPROVED' || doc.status === 'REJECTED' ? doc.status : 'APPROVED');
        setReviewFeedback(doc.feedback || '');
        setReviewOpen(true);
    };

    const submitReview = async () => {
        if (!selectedDoc) return;
        setSubmittingReview(true);
        try {
            await api.put(`/dosen/documents/${selectedDoc.id}`, {
                status: reviewStatus,
                feedback: feedback,
            });
            toast.success('Document reviewed successfully');
            setReviewOpen(false);
            fetchDocuments();
        } catch (error) {
            console.error('Review failed', error);
            toast.error('Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge className="bg-green-500">Approved</Badge>;
            case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>;
            case 'SUBMITTED': return <Badge className="bg-blue-500">Submitted</Badge>;
            default: return <Badge variant="secondary">Draft</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Guidance & Reviews</h1>
                    <p className="text-muted-foreground">Review student documents and provide feedback.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger className="w-[200px] md:w-[300px]">
                            <SelectValue placeholder="Filter by Group" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Groups</SelectItem>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                    {group.title.title} - {group.members[0]?.student.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>


            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No submissions found.
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedDocuments.map((groupDocs, index) => {
                        const firstDoc = groupDocs[0];
                        const groupTitle = firstDoc?.group?.title?.title || `Group ${firstDoc?.group?.id || 'Unknown'}`;

                        return (
                            <Card key={firstDoc?.group?.id || index} className="overflow-hidden">
                                <div className="bg-muted/40 border-b px-6 py-4">
                                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                                        {groupTitle}
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {groupDocs.length} Submission{groupDocs.length !== 1 ? 's' : ''} Documented
                                    </p>
                                </div>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-border">
                                        {groupDocs.map((doc) => (
                                            <div key={doc.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between hover:bg-muted/20 transition-colors">
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
                                                        <span>By <span className="font-medium text-foreground">{doc.student?.name}</span></span>
                                                        <span>&bull;</span>
                                                        <span>{new Date(doc.created_at).toLocaleDateString()} at {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    {doc.feedback && (
                                                        <div className="mt-3 text-sm bg-orange-500/10 text-orange-700 dark:text-orange-400 p-3 rounded-md border border-orange-500/20 max-w-3xl">
                                                            <span className="font-semibold block mb-1">Latest Feedback:</span>
                                                            <p className="whitespace-pre-wrap">{doc.feedback}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                                                        <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${doc.file_path}`} target="_blank" rel="noopener noreferrer">
                                                            <Download className="mr-2 h-4 w-4" /> View
                                                        </a>
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
                        <DialogDescription>
                            Provide feedback and update status for {selectedDoc?.phase}.
                        </DialogDescription>
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
                            <Label>Feedback</Label>
                            <Textarea
                                value={feedback}
                                onChange={(e) => setReviewFeedback(e.target.value)}
                                placeholder="Enter your feedback here..."
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={submitReview} disabled={submittingReview}>
                            {submittingReview ? 'Saving...' : 'Save Review'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
