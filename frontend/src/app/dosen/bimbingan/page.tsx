'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea"
import { FileText, Loader2, Search, Eye } from 'lucide-react';
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    dosbing_1_name: string | null;
    dosbing_2_name: string | null;
    is_dosbing_1: boolean;
    is_dosbing_2: boolean;
}


export default function DosenBimbinganPage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [periods, setPeriods] = useState<{ id: number; name: string; is_active: boolean }[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Review State
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
    const [feedback, setReviewFeedback] = useState('');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);

    const fetchData = useCallback(async (periodId?: string) => {
        if (periodId) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch periods if not already fetched
            if (periods.length === 0) {
                const periodsRes = await api.get('/periods-list');
                setPeriods(periodsRes.data?.data || []);
            }

            const queryParam = periodId && periodId !== 'all' ? `?period_id=${periodId}` : '';
            
            // Re-fetch groups for the selected period
            const groupsRes = await api.get(`/dosen/groups/supervised${queryParam}`);
            setGroups(groupsRes.data.data);

            // Fetch documents for the selected period
            const docParams: Record<string, string | undefined> = {};
            if (periodId && periodId !== 'all') docParams.period_id = periodId;
            if (selectedGroupId !== 'all') docParams.group_id = selectedGroupId;

            const docsRes = await api.get('/dosen/documents', { params: docParams });
            setDocuments(docsRes.data.data);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load guidance data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [periods.length, selectedGroupId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePeriodChange = (val: string) => {
        setSelectedPeriod(val);
        setSelectedGroupId('all'); // Reset group filter when period changes
        fetchData(val);
    };

    const filteredDocuments = useMemo(() => {
        if (!searchQuery) return documents;
        const q = searchQuery.toLowerCase();
        return documents.filter(doc => 
            doc.student?.name.toLowerCase().includes(q) ||
            doc.group?.title?.title.toLowerCase().includes(q) ||
            doc.phase.toLowerCase().includes(q)
        );
    }, [documents, searchQuery]);

    const groupedDocuments = useMemo(() => {
        const groupsMap = new Map<number, Document[]>();
        filteredDocuments.forEach(doc => {
            const groupId = doc.group?.id || 0;
            if (!groupsMap.has(groupId)) {
                groupsMap.set(groupId, []);
            }
            groupsMap.get(groupId)!.push(doc);
        });
        return Array.from(groupsMap.values());
    }, [filteredDocuments]);

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
            fetchData(selectedPeriod);
        } catch (error) {
            console.error('Review failed', error);
            toast.error('Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    const viewDocument = (filePath: string) => {
        // Derive backend URL from API URL (remove /api suffix)
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
        const storageUrl = `${baseUrl}/storage/${filePath}`;
        window.open(storageUrl, '_blank', 'noopener,noreferrer');
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
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Periods" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Period</SelectLabel>
                                <SelectItem value="all">All Periods</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.name} {p.is_active && "(Active)"}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Select value={selectedGroupId} onValueChange={(val) => {
                        setSelectedGroupId(val);
                        // We need to re-fetch docs for this group specifically
                        setLoading(true);
                        const params: Record<string, string | undefined> = { group_id: val === 'all' ? undefined : val };
                        if (selectedPeriod !== 'all') params.period_id = selectedPeriod;
                        api.get('/dosen/documents', { params }).then(res => {
                            setDocuments(res.data.data);
                            setLoading(false);
                        });
                    }}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Filter by Group" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Groups</SelectItem>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                    {group.title?.title || `Group ${group.id}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    placeholder="Search by student, title, or phase..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>


            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <p className="font-medium">No supervised groups found</p>
                    <p className="text-sm mt-1">You are not assigned as a supervisor (Dosbing 1 or Dosbing 2) for any group in this period.</p>
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No submissions found.
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedDocuments.map((groupDocs, index) => {
                        const firstDoc = groupDocs[0];
                        const groupId = firstDoc?.group?.id;
                        const groupInfo = groups.find(g => g.id === groupId);
                        const groupTitle = firstDoc?.group?.title?.title || `Group ${groupId || 'Unknown'}`;

                        return (
                            <Card key={groupId || index} className="overflow-hidden">
                                <div className="bg-muted/40 border-b px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                                            {groupTitle}
                                        </h2>
                                        {groupInfo?.is_dosbing_1 && (
                                            <Badge className="bg-blue-500">Dosbing 1</Badge>
                                        )}
                                        {groupInfo?.is_dosbing_2 && (
                                            <Badge className="bg-green-500">Dosbing 2</Badge>
                                        )}
                                    </div>
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
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="w-full sm:w-auto"
                                                        onClick={() => viewDocument(doc.file_path)}
                                                    >
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
