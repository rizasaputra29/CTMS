'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileCheck, Upload, Send, Info, Lock, CheckCircle, AlertCircle, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface TAStatus {
  can_access: boolean;
  status: string | null;
  message: string;
  group_id: number | null;
  period_id: number | null;
  available_documents: Array<{ type: string; name: string; required: boolean }>;
}

interface TaSubmission {
    id: number;
    status: string;
    file_path: string | null;
    feedback: string | null;
    reviewer: { name: string } | null;
    group: {
        title: { title: string } | null;
        status: string;
    } | null;
}

const STATUS_LABELS: Record<string, string> = {
    TA_BLOCKED: 'Locked',
    TA_DRAFT: 'Draft Submitted',
    TA_REVISED: 'Revised',
    TA_READY: 'Ready for Defense',
    TA_REGISTERED: 'Registered for Defense',
    TA_DEFENDED: 'Defended ✓',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    TA_BLOCKED: 'secondary',
    TA_DRAFT: 'outline',
    TA_REVISED: 'outline',
    TA_READY: 'default',
    TA_REGISTERED: 'default',
    TA_DEFENDED: 'default',
};

export default function TaPage() {
    const [taStatus, setTaStatus] = useState<TAStatus | null>(null);
    const [submission, setSubmission] = useState<TaSubmission | null>(null);
    const [loading, setLoading] = useState(true);
    const [filePath, setFilePath] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch TA status and submission in parallel
            const [statusRes, submissionRes] = await Promise.all([
                api.get('/mahasiswa/ta-status'),
                api.get('/mahasiswa/ta').catch(() => ({ data: { data: null } }))
            ]);
            
            setTaStatus(statusRes.data);
            setSubmission(submissionRes.data.data || null);
        } catch (err) {
            console.error('Failed to fetch TA data', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpload = async () => {
        setSubmitting(true);
        try {
            await api.post('/mahasiswa/ta/upload', { file_path: filePath });
            toast.success('TA draft uploaded.');
            setFilePath('');
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Upload failed');
            else toast.error('Upload failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevise = async () => {
        setSubmitting(true);
        try {
            await api.put('/mahasiswa/ta/revise', { file_path: filePath });
            toast.success('Revision submitted.');
            setFilePath('');
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Revision failed');
            else toast.error('Revision failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async () => {
        if (!confirm('Register for TA defense? This action cannot be undone.')) return;
        setSubmitting(true);
        try {
            await api.post('/mahasiswa/ta/register');
            toast.success('Registered for TA defense.');
            fetchData();
        } catch (error) {
            if (api.isAxiosError(error)) toast.error(error.response?.data?.message || 'Registration failed');
            else toast.error('Registration failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // TA Blocked State
    if (!taStatus || taStatus.status === 'TA_BLOCKED') {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tugas Akhir (TA)</h1>
                    <p className="text-muted-foreground">Individual thesis phase.</p>
                </div>
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-red-600" />
                            <CardTitle className="text-red-800">TA Phase Locked</CardTitle>
                        </div>
                        <CardDescription className="text-red-700">
                            {taStatus?.message || 'TA phase is currently locked.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-700 mb-4">
                            To unlock TA phase, you need to:
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-200 text-red-700 text-xs font-semibold">1</div>
                                <span className="text-sm text-red-700">Complete EXPO with your group</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-200 text-red-700 text-xs font-semibold">2</div>
                                <span className="text-sm text-red-700">Submit peer review for all group members</span>
                            </li>
                        </ul>
                        <Button 
                            variant="outline" 
                            className="mt-6 border-red-600 text-red-700 hover:bg-red-100"
                            onClick={() => window.location.href = '/mahasiswa/peer-review'}
                        >
                            Go to Peer Review
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tugas Akhir (TA)</h1>
                    <p className="text-muted-foreground">Individual thesis phase - No deadline, work at your own pace.</p>
                </div>
                <Badge 
                    variant={taStatus.status === 'TA_DONE' ? 'default' : 'outline'}
                    className={taStatus.status === 'TA_ACTIVE' ? 'bg-green-100 text-green-800' : ''}
                >
                    {taStatus.status === 'TA_ACTIVE' ? 'Active' : taStatus.status === 'TA_DONE' ? 'Completed' : 'Locked'}
                </Badge>
            </div>

            {/* Progress Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>TA Progress</CardTitle>
                    <CardDescription>Complete the following steps to finish your TA.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {taStatus.available_documents.map((doc, index) => (
                            <div key={doc.type} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-medium">{doc.name}</p>
                                        {doc.required && <span className="text-xs text-red-500">*Required</span>}
                                    </div>
                                </div>
                                <Button size="sm" variant="outline">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Upload
                                </Button>
                            </div>
                        ))}
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                    {taStatus.available_documents.length + 1}
                                </div>
                                <div>
                                    <p className="font-medium">Schedule TA Defense</p>
                                    <span className="text-xs text-red-500">*Required</span>
                                </div>
                            </div>
                            <Button size="sm" variant="outline">
                                <Calendar className="mr-2 h-4 w-4" />
                                Schedule
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* TA Submission Section */}
            {!submission ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Your TA Draft</CardTitle>
                        <CardDescription>
                            Submit the first version of your thesis document.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3 items-end">
                            <div className="flex-1">
                                <Label htmlFor="file_path" className='py-2'>File Path / URL</Label>
                                <Input
                                    id="file_path"
                                    placeholder="e.g. uploads/ta-draft-v1.pdf"
                                    value={filePath}
                                    onChange={(e) => setFilePath(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleUpload} disabled={submitting || !filePath}>
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Upload Draft
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Submission Status</CardTitle>
                                <CardDescription>{submission.group?.title?.title || 'No title assigned'}</CardDescription>
                            </div>
                            <Badge variant={STATUS_VARIANTS[submission.status] || 'secondary'}>
                                {STATUS_LABELS[submission.status] || submission.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {submission.file_path && (
                            <div>
                                <span className="text-sm font-medium">Current File:</span>
                                <span className="text-sm text-muted-foreground ml-2">{submission.file_path}</span>
                            </div>
                        )}
                        {submission.feedback && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Reviewer Feedback</AlertTitle>
                                <AlertDescription>{submission.feedback}</AlertDescription>
                            </Alert>
                        )}
                        {submission.reviewer && (
                            <div>
                                <span className="text-sm font-medium">Reviewed by:</span>
                                <span className="text-sm text-muted-foreground ml-2">{submission.reviewer.name}</span>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="border-t pt-4 gap-3">
                        {/* Revise: available when draft or after feedback */}
                        {['TA_DRAFT', 'TA_REVISED'].includes(submission.status) && (
                            <div className="flex gap-3 items-end w-full">
                                <div className="flex-1">
                                    <Input
                                        placeholder="New file path for revision"
                                        value={filePath}
                                        onChange={(e) => setFilePath(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleRevise} disabled={submitting || !filePath} variant="outline">
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Submit Revision
                                </Button>
                            </div>
                        )}
                        {/* Register for defense: available when Ready */}
                        {submission.status === 'TA_READY' && (
                            <Button onClick={handleRegister} disabled={submitting} className="w-full">
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                                Register for TA Defense
                            </Button>
                        )}
                        {/* Defended: show completion */}
                        {submission.status === 'TA_DEFENDED' && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 w-full">
                                <FileCheck className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800 dark:text-green-300">TA Defended</AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-400">
                                    Congratulations! Your thesis defense is complete.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardFooter>
                </Card>
            )}

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-blue-800">Important Information</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm text-blue-700">
                        <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                            <span>TA phase has no deadline. Work at your own pace.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                            <span>You can schedule your defense when all documents are uploaded.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                            <span>Contact your supervisor for guidance during the TA phase.</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
