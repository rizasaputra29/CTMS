'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Upload, FileText, Download, Check, Lock, Clock, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";
import axios from 'axios';
import { cn } from '@/lib/utils';

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
}

interface PhaseDocumentType {
    type: string;
    status: string;
    latest_document: Document | null;
}

interface PhaseInfo {
    phase: string;
    status: 'locked' | 'unlocked' | 'submitted' | 'draft' | 'revision' | 'completed';
    documents: PhaseDocumentType[];
    required_types: string[];
    document_count: number;
}

interface WorkflowData {
    phases: PhaseInfo[];
    current_phase: string | null;
    is_graduated: boolean;
}

const PHASE_LABELS: Record<string, string> = {
    'PDC1': 'PDC 1',
    'SEMPRO': 'Seminar Proposal',
    'PDC2': 'PDC 2',
    'TA': 'Tugas Akhir',
    'SIDANG': 'Sidang',
    'EXPO': 'Expo',
};

export default function MahasiswaDocumentsPage() {
    const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadPhase, setUploadPhase] = useState('');
    const [uploadType, setUploadType] = useState('GENERAL');
    const [requiredTypesForUpload, setRequiredTypesForUpload] = useState<string[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [groupStatus, setGroupStatus] = useState<string | null>(null);
    const [hasGroup, setHasGroup] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // First check group status
            const groupRes = await api.get('/mahasiswa/group');
            const group = groupRes.data.group;
            setHasGroup(!!group);
            setGroupStatus(group?.status || null);

            // Only fetch workflow/docs if group is approved
            const isApproved = group && ![
                'FORMING',
                'READY_FOR_BIDDING',
                'WAITING_SUPERVISOR_APPROVAL',
                'REJECTED'
            ].includes(group.status);

            if (isApproved) {
                const [workflowRes, docsRes] = await Promise.all([
                    api.get('/mahasiswa/workflow'),
                    api.get('/mahasiswa/documents'),
                ]);
                setWorkflow(workflowRes.data);
                setDocuments(docsRes.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const openUploadDialog = (phase: string, docType: string) => {
        setUploadPhase(phase);
        setUploadType(docType);
        setFile(null);
        setUploadOpen(true);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            toast.error('Please select a file');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('phase', uploadPhase);
        formData.append('document_type', uploadType);

        try {
            await api.post('/mahasiswa/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Document uploaded successfully');
            setUploadOpen(false);
            setFile(null);
            fetchData();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Upload failed');
            } else {
                toast.error('Upload failed');
            }
        } finally {
            setUploading(false);
        }
    };

    const getPhaseIcon = (status: string) => {
        switch (status) {
            case 'completed': return <Check className="h-5 w-5" />;
            case 'submitted': return <Clock className="h-5 w-5" />;
            case 'revision': return <AlertTriangle className="h-5 w-5" />;
            case 'locked': return <Lock className="h-5 w-5" />;
            default: return <FileText className="h-5 w-5" />;
        }
    };

    const getPhaseColor = (status: string) => {
        switch (status) {
            case 'completed': return 'border-green-500 bg-green-500 text-white';
            case 'submitted': return 'border-blue-500 bg-blue-500 text-white';
            case 'revision': return 'border-yellow-500 bg-yellow-500 text-white';
            case 'locked': return 'border-muted-foreground/30 bg-muted text-muted-foreground';
            default: return 'border-primary bg-background text-primary';
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

    if (loading) {
        return (
            <div className="p-4 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const isGroupApproved = groupStatus && ![
        'FORMING',
        'READY_FOR_BIDDING',
        'WAITING_SUPERVISOR_APPROVAL',
        'REJECTED'
    ].includes(groupStatus);

    // Lock documents if student doesn't have an approved group
    if (!hasGroup || !isGroupApproved) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Documents & Workflow</h1>
                    <p className="text-muted-foreground">Complete each phase sequentially to progress toward graduation.</p>
                </div>
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Lock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Documents Locked</h2>
                        <p className="text-muted-foreground max-w-md mb-6">
                            {!hasGroup
                                ? 'You need to select a title and form a group before you can upload documents.'
                                : groupStatus === 'PENDING'
                                    ? 'Your group is pending approval from your lecturer. Documents will be available once approved.'
                                    : 'Your group needs to be approved before you can access documents.'}
                        </p>
                        {!hasGroup ? (
                            <Button asChild>
                                <Link href="/mahasiswa/titles">Browse Titles</Link>
                            </Button>
                        ) : (
                            <Button variant="outline" asChild>
                                <Link href="/mahasiswa/group">View Group Status</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Documents & Workflow</h1>
                <p className="text-muted-foreground">Complete each phase sequentially to progress toward graduation.</p>
            </div>

            {/* Workflow Stepper */}
            {workflow && (
                <div className="space-y-4">
                    {workflow.is_graduated && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                            <h2 className="text-xl font-bold text-green-600">🎓 Congratulations! All phases completed.</h2>
                        </div>
                    )}

                    {/* Horizontal stepper on desktop, vertical on mobile */}
                    <div className="relative">
                        <div className="hidden md:block absolute top-6 left-[calc(100%/12)] right-[calc(100%/12)] h-0.5 bg-muted z-0" />
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative z-10">
                            {workflow.phases.map((phaseInfo) => {
                                const canUpload = phaseInfo.status === 'unlocked' || phaseInfo.status === 'revision';
                                return (
                                    <div key={phaseInfo.phase} className="flex flex-col items-center text-center">
                                        <div className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all mb-2",
                                            getPhaseColor(phaseInfo.status),
                                            phaseInfo.status === 'unlocked' && "ring-4 ring-primary/20"
                                        )}>
                                            {getPhaseIcon(phaseInfo.status)}
                                        </div>
                                        <h3 className={cn(
                                            "font-medium text-sm",
                                            phaseInfo.status === 'locked' && "text-muted-foreground"
                                        )}>
                                            {PHASE_LABELS[phaseInfo.phase] || phaseInfo.phase}
                                        </h3>
                                        {/* Show breakdown of required docs if multiple */}
                                        {phaseInfo.required_types.length > 1 && (
                                            <div className="flex flex-col gap-1 mt-2 w-full px-2">
                                                {phaseInfo.documents.map(d => {
                                                    const canUploadType = phaseInfo.status !== 'locked' && d.status !== 'APPROVED';
                                                    return (
                                                        <div key={d.type} className="flex flex-col items-center justify-center p-1 border rounded bg-muted/30">
                                                            <span className={cn(
                                                                "text-[10px] font-medium leading-none mb-1",
                                                                d.status === 'APPROVED' ? 'text-green-600' : d.status === 'missing' ? 'text-red-500' : 'text-primary'
                                                            )}>
                                                                {d.type}: {d.status === 'missing' ? 'Missing' : d.status}
                                                            </span>
                                                            {canUploadType && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 text-[10px] px-2"
                                                                    onClick={() => openUploadDialog(phaseInfo.phase, d.type)}
                                                                >
                                                                    {d.status === 'missing' ? 'Upload' : 'Re-upload'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {phaseInfo.required_types.length <= 1 && (
                                            <p className="text-xs text-muted-foreground capitalize mt-0.5">{phaseInfo.status}</p>
                                        )}
                                        {/* Single document phase upload button */}
                                        {phaseInfo.required_types.length <= 1 && phaseInfo.status !== 'locked' && phaseInfo.status !== 'completed' && (
                                            <Button size="sm" className="mt-2 text-xs h-7" onClick={() => openUploadDialog(phaseInfo.phase, phaseInfo.required_types[0] || 'GENERAL')}>
                                                <Upload className="mr-1 h-3 w-3" /> Upload
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Phase Cards with Documents */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Submitted Documents</h2>
                {documents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                        No documents uploaded yet. Start by uploading your PDC 1 document above.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {documents.map((doc) => (
                            <Card key={doc.id}>
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <div>
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            {PHASE_LABELS[doc.phase] || doc.phase} {doc.document_type && doc.document_type !== 'GENERAL' ? `- ${doc.document_type}` : ''}
                                            <span className="text-xs font-normal text-muted-foreground">v{doc.version}</span>
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            {new Date(doc.created_at).toLocaleDateString()} • {new Date(doc.created_at).toLocaleTimeString()}
                                        </CardDescription>
                                    </div>
                                    {getStatusBadge(doc.status)}
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="text-sm">
                                        <span className="font-semibold">Uploaded by:</span> {doc.student?.name || 'Unknown'}
                                    </div>
                                    {doc.feedback && (
                                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                                            <span className="font-semibold block mb-1">Feedback:</span>
                                            {doc.feedback}
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                    <Button variant="outline" size="sm" className="w-full" asChild>
                                        <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${doc.file_path}`} target="_blank" rel="noopener noreferrer">
                                            <Download className="mr-2 h-4 w-4" /> Download
                                        </a>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleUpload}>
                        <DialogHeader>
                            <DialogTitle>Upload Document</DialogTitle>
                            <DialogDescription>
                                Upload your <strong>{PHASE_LABELS[uploadPhase] || uploadPhase}</strong> document (PDF/DOCX, max 10MB).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {uploadType !== 'GENERAL' && (
                                <div className="grid gap-2">
                                    <Label>Document Type</Label>
                                    <Input value={uploadType} disabled />
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="file">File</Label>
                                <Input id="file" type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" required />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Upload'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
