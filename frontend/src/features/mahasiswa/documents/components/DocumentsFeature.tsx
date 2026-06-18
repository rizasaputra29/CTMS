"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { Upload, FileText, Download, Check, Lock, Circle, AlertTriangle, Info } from 'lucide-react';
import { toast } from "sonner";
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { Loading } from '@/components/ui/loading';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Document,
    WorkflowData,
    PHASE_LABELS,
} from '../types';

export function DocumentsFeature() {
    const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadPhase, setUploadPhase] = useState('');
    const [uploadType, setUploadType] = useState('GENERAL');
    const [file, setFile] = useState<File | null>(null);
    const [groupStatus, setGroupStatus] = useState<string | null>(null);
    const [hasGroup, setHasGroup] = useState(false);
    const [docSearch, setDocSearch] = useState('');
    const [docSortKey, setDocSortKey] = useState<string>('created_at');
    const [docSortDir, setDocSortDir] = useState<'asc' | 'desc'>('desc');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // First check group status
            const groupRes = await api.get('/mahasiswa/group');
            const groupData = groupRes.data?.data ?? groupRes.data;
            const group = groupData?.group ?? groupData;
            setHasGroup(!!group);
            setGroupStatus(group?.status || null);

            // Only fetch workflow/docs if group is approved
            const isApproved = group && ![
                'FORMING',
                'FORMING_SOLO',
                'READY_FOR_BIDDING',
                'REJECTED'
            ].includes(group.status);

            if (isApproved) {
                const [workflowRes, docsRes] = await Promise.all([
                    api.get('/mahasiswa/workflow'),
                    api.get('/mahasiswa/documents'),
                ]);
                setWorkflow(workflowRes.data?.data ?? workflowRes.data);
                setDocuments(docsRes.data?.data ?? docsRes.data ?? []);
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
        // Check if SEMPRO schedule exists before allowing upload
        if (phase === 'SEMPRO') {
            const schedule = workflow?.next_phase_requirements?.seminar_schedule;
            if (!schedule?.exists) {
                toast.error('SEMPRO belum dijadwalkan. Mohon tunggu admin menjadwalkan SEMPRO terlebih dahulu.');
                return;
            }
        }
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
        } catch (error: unknown) {
            const message = api.isAxiosError(error)
                ? (error.response?.data?.message || error.message || 'Upload failed')
                : 'Upload failed';
            toast.error(message);
        } finally {
            setUploading(false);
        }
    };

    const getPhaseIcon = (status: string) => {
        switch (status) {
            case 'completed': return <Check className="h-5 w-5" strokeWidth={3} />;
            case 'locked': return <Lock className="h-4 w-4" />;
            default: return <Circle className="h-5 w-5" />;
        }
    };

    const getPhaseColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-50 border-emerald-500 text-emerald-600';
            case 'locked': return 'bg-gray-100 border-gray-200 text-gray-400';
            default: return 'bg-white border-primary-500 text-primary-500';
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

    const handleDownloadDocument = async (docId: number) => {
        try {
            const response = await api.get(`/mahasiswa/documents/${docId}/download`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `document-${docId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: unknown) {
            console.error('Failed to download document:', error);
            const message = api.isAxiosError(error)
                ? (error.response?.data?.message || error.message || 'Failed to download document')
                : 'Failed to download document';
            toast.error(message);
        }
    };

    const filteredDocuments = useMemo(() => {
        let filtered = [...documents];

        if (docSearch) {
            const q = docSearch.toLowerCase();
            filtered = (filtered ?? []).filter(doc =>
                (PHASE_LABELS[doc.phase] || doc.phase).toLowerCase().includes(q) ||
                (doc.document_type || 'General').toLowerCase().includes(q) ||
                doc.status.toLowerCase().includes(q) ||
                (doc.student?.name || '').toLowerCase().includes(q)
            );
        }

        filtered.sort((a, b) => {
            let cmp = 0;
            switch (docSortKey) {
                case 'phase':
                    cmp = (PHASE_LABELS[a.phase] || a.phase).localeCompare(PHASE_LABELS[b.phase] || b.phase);
                    break;
                case 'document_type':
                    cmp = (a.document_type || 'General').localeCompare(b.document_type || 'General');
                    break;
                case 'version':
                    cmp = a.version - b.version;
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status);
                    break;
                case 'uploaded_by':
                    cmp = (a.student?.name || '').localeCompare(b.student?.name || '');
                    break;
                case 'created_at':
                    cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
            }
            return docSortDir === 'asc' ? cmp : -cmp;
        });

        return filtered;
    }, [documents, docSearch, docSortKey, docSortDir]);

    const columns: DataTableColumn<Document>[] = useMemo(() => [
        { key: 'no', header: 'No', width: 'w-12' },
        {
            key: 'phase',
            header: 'Phase',
            sortable: true,
            render: (doc) => <span className="text-sm">{PHASE_LABELS[doc.phase] || doc.phase}</span>,
        },
        {
            key: 'document_type',
            header: 'Document Type',
            sortable: true,
            render: (doc) => <span className="text-sm">{doc.document_type && doc.document_type !== 'GENERAL' ? doc.document_type : 'General'}</span>,
        },
        {
            key: 'version',
            header: 'Version',
            sortable: true,
            align: 'center',
            width: 'w-16',
            render: (doc) => <span className="text-sm text-muted-foreground">v{doc.version}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            align: 'center',
            width: 'w-24',
            render: (doc) => getStatusBadge(doc.status),
        },
        {
            key: 'uploaded_by',
            header: 'Uploaded By',
            sortable: true,
            render: (doc) => <span className="text-sm text-muted-foreground">{doc.student?.name || 'Unknown'}</span>,
        },
        {
            key: 'created_at',
            header: 'Uploaded At',
            sortable: true,
            render: (doc) => (
                <span className="text-muted-foreground whitespace-nowrap text-sm">
                    {formatDateTime(doc.created_at)}
                </span>
            ),
        },
        {
            key: 'feedback',
            header: 'Feedback',
            render: (doc) => {
                if (!doc.feedback) return <span className="text-sm text-muted-foreground">-</span>;
                const truncated = doc.feedback.length > 50 ? doc.feedback.slice(0, 50) + '...' : doc.feedback;
                return <span className="text-sm text-muted-foreground max-w-[200px] block truncate" title={doc.feedback}>{truncated}</span>;
            },
        },
        {
            key: 'action',
            header: 'Aksi',
            align: 'center',
            width: 'w-20',
            render: (doc) => (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={(e) => { e.stopPropagation(); handleDownloadDocument(doc.id); }}
                >
                    <Download className="mr-1 h-3 w-3" /> Download
                </Button>
            ),
        },
    ], []);

    const handleDocSort = (key: string) => {
        if (docSortKey === key) {
            setDocSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setDocSortKey(key);
            setDocSortDir('asc');
        }
    };

    if (loading) return <Loading variant="section" />;

    const isGroupApproved = groupStatus && ![
        'FORMING',
        'FORMING_SOLO',
        'READY_FOR_BIDDING',
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

    const req = workflow?.next_phase_requirements;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Documents & Workflow</h1>
                <p className="text-muted-foreground">Complete each phase sequentially to progress toward graduation.</p>
            </div>

            {/* Next Phase Requirements Alerts */}
            <div className="space-y-3">
                {req && (
                    <>
                    {/* SEMPRO Schedule Status - Show when current phase is SEMPRO */}
                    {req.current_phase === 'SEMPRO' && (
                        <>
                            {!req.seminar_schedule?.exists ? (
                                <Alert variant="default" className="border-amber-500 bg-amber-50">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertTitle className="text-amber-800">⏳ Menunggu Jadwal SEMPRO</AlertTitle>
                                    <AlertDescription className="text-amber-700">
                                        SEMPRO belum dijadwalkan oleh admin. Anda tidak dapat mengupload 
                                        dokumen bukti SEMPRO hingga jadwal ditetapkan.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert variant="default" className="border-blue-500 bg-blue-50">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    <AlertTitle className="text-blue-800">📅 Jadwal SEMPRO Telah Ditetapkan</AlertTitle>
                                    <AlertDescription className="text-blue-700">
                                        <div className="mt-2 space-y-1">
                                            <p>
                                                <strong>Tanggal:</strong>{' '}
                                                {formatDate(req.seminar_schedule.date!)}
                                            </p>
                                            <p>
                                                <strong>Waktu:</strong>{' '}
                                                {req.seminar_schedule.start_time} - {req.seminar_schedule.end_time}
                                            </p>
                                            <p>
                                                <strong>Ruangan:</strong> {req.seminar_schedule.room}
                                            </p>
                                            <p>
                                                <strong>Penguji:</strong>{' '}
                                                {req.seminar_schedule.examiners?.map(e => e.name).join(' & ')}
                                            </p>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {/* Pending Examiner Evaluations */}
                            {req.seminar_schedule?.exists && req.seminar_schedule.examiner_evaluations && req.seminar_schedule.examiner_evaluations.pending > 0 && (
                                <Alert variant="default" className="border-orange-500 bg-orange-50">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <AlertTitle className="text-orange-800">📝 Menunggu Penilaian Penguji</AlertTitle>
                                    <AlertDescription className="text-orange-700">
                                        <p className="mb-2">
                                            {req.seminar_schedule.examiner_evaluations.submitted}/{req.seminar_schedule.examiner_evaluations.total} penguji telah menilai.
                                            Berikut penguji yang belum menyelesaikan penilaian:
                                        </p>
                                        <ul className="mt-2 space-y-2">
                                            {(req.seminar_schedule.examiner_evaluations.examiners ?? [])
                                                .filter((e) => e.status !== 'SUBMITTED')
                                                .map((e) => (
                                                    <li key={e.id} className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                                                        <span>{e.name} - Belum menilai</span>
                                                    </li>
                                                ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {/* All Examiner Evaluations Complete */}
                            {req.seminar_schedule?.exists && req.seminar_schedule.examiner_evaluations && req.seminar_schedule.examiner_evaluations.pending === 0 && req.seminar_schedule.examiner_evaluations.total > 0 && (
                                <Alert variant="default" className="border-green-500 bg-green-50">
                                    <Check className="h-4 w-4 text-green-600" />
                                    <AlertTitle className="text-green-800">✅ Penilaian Penguji Lengkap</AlertTitle>
                                    <AlertDescription className="text-green-700">
                                        Semua penguji telah menyelesaikan penilaian SEMPRO.
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {/* Pending Supervisor BIMBINGAN_SEMPRO */}
                            {req.seminar_schedule?.exists && req.seminar_schedule.supervisor_bimbingan && req.seminar_schedule.supervisor_bimbingan.supervisors.some((s) => s.status === 'pending') && (
                                <Alert variant="default" className="border-amber-500 bg-amber-50">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertTitle className="text-amber-800">👨‍🏫 Menunggu Penilaian Pembimbing (BIMBINGAN SEMPRO)</AlertTitle>
                                    <AlertDescription className="text-amber-700">
                                        <p className="mb-2">
                                            Penilaian BIMBINGAN_SEMPRO dari dosen pembimbing masih menunggu:
                                        </p>
                                        <ul className="mt-2 space-y-2">
                                            {(req.seminar_schedule.supervisor_bimbingan.supervisors ?? [])
                                                .filter((s) => s.status === 'pending')
                                                .map((s) => (
                                                    <li key={s.id} className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                        <span>
                                                            {s.name} ({s.role === 'SUPERVISOR_1' ? 'Pembimbing 1' : 'Pembimbing 2'})
                                                            {typeof s.submitted_components === 'number' && typeof s.total_components === 'number' && (
                                                                <span className="text-sm text-muted-foreground ml-2">
                                                                    - {s.submitted_components}/{s.total_components} komponen
                                                                </span>
                                                            )}
                                                        </span>
                                                    </li>
                                                ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {/* All Supervisor BIMBINGAN_SEMPRO Complete */}
                            {req.seminar_schedule?.exists && req.seminar_schedule.supervisor_bimbingan && req.seminar_schedule.supervisor_bimbingan.supervisors.every((s) => s.status === 'completed') && req.seminar_schedule.supervisor_bimbingan.supervisors.length > 0 && (
                                <Alert variant="default" className="border-green-500 bg-green-50">
                                    <Check className="h-4 w-4 text-green-600" />
                                    <AlertTitle className="text-green-800">✅ Penilaian Pembimbing Lengkap</AlertTitle>
                                    <AlertDescription className="text-green-700">
                                        Semua dosen pembimbing telah menyelesaikan penilaian BIMBINGAN_SEMPRO.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Final readiness for PDC2 */}
                            {req.seminar_schedule?.exists && (
                                req.seminar_schedule.is_ready_for_pdc2 ? (
                                    <Alert variant="default" className="border-green-500 bg-green-50">
                                        <Check className="h-4 w-4 text-green-600" />
                                        <AlertTitle className="text-green-800">✅ Siap Masuk PDC2</AlertTitle>
                                        <AlertDescription className="text-green-700">
                                            Semua syarat SEMPRO sudah terpenuhi (dokumen, nilai penguji, dan BIMBINGAN_SEMPRO pembimbing).
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert variant="default" className="border-amber-500 bg-amber-50">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        <AlertTitle className="text-amber-800">🔒 PDC2 Masih Terkunci</AlertTitle>
                                        <AlertDescription className="text-amber-700">
                                            PDC2 akan tetap terkunci sampai seluruh syarat SEMPRO terpenuhi.
                                        </AlertDescription>
                                    </Alert>
                                )
                            )}
                        </>
                    )}

                    {/* Documents Complete, Waiting for Supervisors */}
                    {req.documents.completed && (
                        (() => {
                            const supervisorBlocks = req.supervisor_evaluations && req.supervisor_evaluations.length > 0
                                ? req.supervisor_evaluations
                                : (req.supervisor_evaluation ? [req.supervisor_evaluation] : []);
                            const hasPendingSupervisorBlocks = supervisorBlocks.some((block) => !block.completed);
                            if (!hasPendingSupervisorBlocks) return null;

                            return (
                        <Alert variant="default" className="border-blue-500 bg-blue-50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">⏳ Menunggu Penilaian Dosen Pembimbing</AlertTitle>
                            <AlertDescription className="text-blue-700">
                                Semua dokumen telah disetujui. Menunggu penilaian dosen untuk bisa melanjutkan ke fase{' '}
                                <strong>{PHASE_LABELS[req.next_phase] || req.next_phase}</strong>:
                                {supervisorBlocks
                                    .filter((block) => !block.completed)
                                    .map((block) => (
                                        <div key={block.required} className="mt-3 first:mt-2">
                                            <p className="font-medium">Jenis nilai: {block.required}</p>
                                            <ul className="mt-1 space-y-2">
                                                {(block.supervisors ?? [])
                                                    .filter((s) => s.status === 'pending')
                                                    .map((s) => (
                                                        <li key={`${block.required}-${s.id}`} className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                            <span>
                                                                {s.name} ({s.role === 'SUPERVISOR_1' ? 'Pembimbing 1' : 'Pembimbing 2'})
                                                                <span className="text-sm text-muted-foreground ml-2">
                                                                    - {s.submitted_components}/{s.total_components} komponen
                                                                </span>
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    ))}
                            </AlertDescription>
                        </Alert>
                            );
                        })()
                    )}

                    {/* All Requirements Met */}
                    {req.documents.completed && (() => {
                        const supervisorBlocks = req.supervisor_evaluations && req.supervisor_evaluations.length > 0
                            ? req.supervisor_evaluations
                            : (req.supervisor_evaluation ? [req.supervisor_evaluation] : []);
                        const allSupervisorBlocksComplete = supervisorBlocks.every((block) => block.completed);
                        if (!allSupervisorBlocksComplete) return null;
                        return (
                        <Alert variant="default" className="border-green-500 bg-green-50">
                            <Check className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">✅ Siap Melanjutkan</AlertTitle>
                            <AlertDescription className="text-green-700">
                                Semua persyaratan telah terpenuhi. Anda dapat melanjutkan ke fase{' '}
                                <strong>{PHASE_LABELS[req.next_phase] || req.next_phase}</strong>.
                            </AlertDescription>
                        </Alert>
                        );
                    })()}
                    </>

                )}

            </div>

            {/* Workflow Stepper */}
            {workflow && (
                <div className="space-y-4">
                    {workflow.is_graduated && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                            <h2 className="text-xl font-bold text-green-600">🎓 Congratulations! All phases completed.</h2>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {(workflow?.phases ?? []).map((phaseInfo) => {
                                const isActive = phaseInfo.phase === workflow.current_phase;
                                const isCompleted = phaseInfo.status === 'completed';
                                const isLocked = phaseInfo.status === 'locked';
                                const labelColor = isCompleted ? 'text-emerald-700' : isLocked ? 'text-gray-400' : 'text-gray-700';
                                const semproSchedule = workflow?.next_phase_requirements?.seminar_schedule;
                                const semproBlocked = phaseInfo.phase === 'SEMPRO' && !semproSchedule?.exists && !isCompleted;
                                const canUploadPhase = !isLocked && !isCompleted && !semproBlocked;

                                return (
                                    <TooltipProvider key={phaseInfo.phase} delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex flex-col items-center gap-2 cursor-pointer">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all",
                                                        getPhaseColor(phaseInfo.status),
                                                        isActive && "ring-2 ring-primary-500/30"
                                                    )}>
                                                        {getPhaseIcon(phaseInfo.status)}
                                                    </div>
                                                    <span className={cn("text-xs font-medium text-center leading-tight", labelColor)}>
                                                        {PHASE_LABELS[phaseInfo.phase] || phaseInfo.phase}
                                                    </span>
                                                    <div className="flex flex-col items-center gap-1 w-full">
                                                        {(phaseInfo.required_types ?? []).length > 1 ? (
                                                            (phaseInfo.documents ?? []).map((d) => {
                                                                const canUploadType = canUploadPhase && d.status !== 'APPROVED';
                                                                return (
                                                                    <div key={d.type} className="flex flex-col items-center gap-0.5 w-full">
                                                                        <span className={cn(
                                                                            "text-[10px]",
                                                                            d.status === 'APPROVED' ? 'text-emerald-600' :
                                                                            d.status === 'missing' ? 'text-red-500' :
                                                                            d.status === 'SUBMITTED' ? 'text-blue-500' : 'text-gray-500'
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
                                                                        {semproBlocked && (
                                                                            <span className="text-[10px] text-amber-600">Menunggu jadwal</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <>
                                                                {phaseInfo.document_count > 0 && phaseInfo.documents[0] ? (
                                                                    <span className={cn(
                                                                        "text-[10px]",
                                                                        phaseInfo.documents[0].status === 'APPROVED' ? 'text-emerald-600' :
                                                                        phaseInfo.documents[0].status === 'SUBMITTED' ? 'text-blue-500' :
                                                                        'text-gray-500'
                                                                    )}>
                                                                        {phaseInfo.documents[0].type}: {phaseInfo.documents[0].status}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-400">
                                                                        {isLocked ? 'Locked' : 'No documents'}
                                                                    </span>
                                                                )}
                                                                {canUploadPhase && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="text-[10px] h-6 px-2"
                                                                        onClick={() => openUploadDialog(phaseInfo.phase, phaseInfo.required_types[0] || 'GENERAL')}
                                                                    >
                                                                        <Upload className="mr-1 h-3 w-3" />
                                                                        {phaseInfo.documents[0] && phaseInfo.documents[0].status !== 'missing' ? 'Re-upload' : 'Upload'}
                                                                    </Button>
                                                                )}
                                                                {semproBlocked && (
                                                                    <span className="text-[10px] text-amber-600">Menunggu jadwal</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs">
                                                <p className="font-medium">{PHASE_LABELS[phaseInfo.phase] || phaseInfo.phase}</p>
                                                <p className="text-muted-foreground capitalize">{phaseInfo.status}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Submitted Documents Table */}
            <DataTable<Document>
                title="Submitted Documents"
                data={filteredDocuments}
                columns={columns}
                loading={loading}
                emptyMessage="No documents uploaded yet."
                emptySubMessage="Start by uploading your PDC 1 document above."
                emptyIcon={<FileText className="h-10 w-10" />}
                searchValue={docSearch}
                onSearchChange={setDocSearch}
                searchPlaceholder="Search documents..."
                sortKey={docSortKey}
                sortDir={docSortDir}
                onSort={handleDocSort}
            />

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
