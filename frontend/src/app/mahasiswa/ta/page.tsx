'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileCheck, Upload, Send, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';

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
    TA_LOCKED: 'Locked',
    TA_DRAFT: 'Draft Submitted',
    TA_REVISED: 'Revised',
    TA_READY: 'Ready for Defense',
    TA_REGISTERED: 'Registered for Defense',
    TA_DEFENDED: 'Defended ✓',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    TA_LOCKED: 'secondary',
    TA_DRAFT: 'outline',
    TA_REVISED: 'outline',
    TA_READY: 'default',
    TA_REGISTERED: 'default',
    TA_DEFENDED: 'default',
};

export default function TaPage() {
    const [submission, setSubmission] = useState<TaSubmission | null>(null);
    const [loading, setLoading] = useState(true);
    const [filePath, setFilePath] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchSubmission = useCallback(async () => {
        try {
            const res = await api.get('/mahasiswa/ta');
            setSubmission(res.data.data || null);
        } catch (err) {
            console.error('Failed to fetch TA', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmission();
    }, [fetchSubmission]);

    const handleUpload = async () => {
        setSubmitting(true);
        try {
            await api.post('/mahasiswa/ta/upload', { file_path: filePath });
            toast.success('TA draft uploaded.');
            setFilePath('');
            fetchSubmission();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Upload failed');
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
            fetchSubmission();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Revision failed');
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
            fetchSubmission();
        } catch (error) {
            if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || 'Registration failed');
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">TA Submission</h1>
                <p className="text-muted-foreground">Upload your thesis/TA, track review status, and register for defense.</p>
            </div>

            {!submission ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Your TA Draft</CardTitle>
                        <CardDescription>
                            Submit the first version of your thesis document. Your group must be at least in PDC2 Active status.
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
                <>
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
                                <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                                    <FileCheck className="h-4 w-4 text-green-600" />
                                    <AlertTitle className="text-green-800 dark:text-green-300">TA Defended</AlertTitle>
                                    <AlertDescription className="text-green-700 dark:text-green-400">
                                        Congratulations! Your thesis defense is complete.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardFooter>
                    </Card>
                </>
            )}
        </div>
    );
}
