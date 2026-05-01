'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Upload, FileText, Download, Check, Lock, Clock, AlertTriangle, Info } from 'lucide-react';
import { toast } from "sonner";
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

interface SupervisorStatus {
    id: number;
    name: string;
    role: string;
    status: 'completed' | 'pending';
    submitted_components: number;
    total_components: number;
}

interface ExaminerInfo {
    id: number;
    name: string;
}

interface ExaminerEvaluationStatus {
    id: number;
    name: string;
    status: string;
}

interface ExaminerEvaluationsInfo {
    total: number;
    submitted: number;
    pending: number;
    examiners: ExaminerEvaluationStatus[];
}

interface SupervisorBimbinganStatus {
    id: number;
    name: string;
    role: string;
    status: 'completed' | 'pending';
    submitted_components?: number;
    total_components?: number;
}

interface SupervisorBimbinganInfo {
    required: boolean;
    evaluation_type: string;
    component_count?: number;
    all_submitted?: boolean;
    supervisors: SupervisorBimbinganStatus[];
}

interface SeminarScheduleInfo {
    exists: boolean;
    date?: string;
    room?: string;
    start_time?: string;
    end_time?: string;
    examiners?: ExaminerInfo[];
    status?: string;
    message?: string;
    examiner_evaluations?: ExaminerEvaluationsInfo;
    supervisor_bimbingan?: SupervisorBimbinganInfo;
    is_ready_for_pdc2?: boolean;
}

interface NextPhaseRequirements {
    current_phase: string;
    next_phase: string;
    documents: {
        completed: boolean;
        total_required: number;
        approved_count: number;
        pending_types: string[];
    };
    supervisor_evaluation: {
        required: string;
        completed: boolean;
        component_count: number;
        supervisors: SupervisorStatus[];
    } | null;
    supervisor_evaluations?: {
        required: string;
        completed: boolean;
        component_count: number;
        supervisors: SupervisorStatus[];
    }[];
    seminar_schedule: SeminarScheduleInfo | null;
}

interface WorkflowData {
    phases: PhaseInfo[];
    current_phase: string | null;
    is_graduated: boolean;
    next_phase_requirements: NextPhaseRequirements | null;
    final_ready_for_ta_individual?: {
        ready: boolean;
        expo_documents: {
            completed: boolean;
            pending_types: string[];
            total_required: number;
            approved_count: number;
        };
        nilai_dosen: {
            required: boolean;
            configured: boolean;
            completed: boolean;
            component_count: number;
            supervisors: SupervisorStatus[];
        };
        milestone: {
            required: boolean;
            configured: boolean;
            completed: boolean;
            component_count: number;
            supervisors: SupervisorStatus[];
        };
        expo_evaluation: {
            required: boolean;
            configured: boolean;
            completed: boolean;
            component_count: number;
            supervisors: SupervisorStatus[];
        };
        peer_review: {
            required: boolean;
            configured: boolean;
            completed: boolean;
            indicator_count: number;
            total_members: number;
            completed_members: number;
            incomplete_students: {
                student_id: number;
                student_name: string;
                student_nim: string;
            }[];
        };
    };
}

interface StepperPhaseInfo extends PhaseInfo {
    ui_only?: boolean;
}

const PHASE_LABELS: Record<string, string> = {
    'PDC1': 'PDC 1',
    'SEMPRO': 'Seminar Proposal',
    'PDC2': 'PDC 2',
    'TA_DRAFT': 'TA Draft (Group)',
    'EXPO': 'Expo',
    'TA_INDIVIDUAL_READY': 'Ready for TA Individual',
};

const DESKTOP_GRID_COLS_CLASS: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    7: 'md:grid-cols-7',
    8: 'md:grid-cols-8',
};

export default function MahasiswaDocumentsPage() {
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
                'FORMING_SOLO',
                'READY_FOR_BIDDING',
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
        
        // Auto-refresh every 30 seconds to check supervisor evaluation updates
        const interval = setInterval(fetchData, 30000);
        
        return () => clearInterval(interval);
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
        } catch (error) {
            if (api.isAxiosError(error)) {
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
        'FORMING_SOLO',
        'READY_FOR_BIDDING',
        'REJECTED'
    ].includes(groupStatus);

    const finalUiStep: StepperPhaseInfo | null = workflow?.final_ready_for_ta_individual
        ? {
            phase: 'TA_INDIVIDUAL_READY',
            status: workflow.final_ready_for_ta_individual.ready ? 'completed' : 'locked',
            documents: [],
            required_types: [],
            document_count: 0,
            ui_only: true,
        }
        : null;

    const stepperPhases: StepperPhaseInfo[] = workflow
        ? [...workflow.phases, ...(finalUiStep ? [finalUiStep] : [])]
        : [];

    const stepCount = stepperPhases.length;

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
                                                {new Date(req.seminar_schedule.date!).toLocaleDateString('id-ID', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                })}
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
                                            {req.seminar_schedule.examiner_evaluations.examiners
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
                                            {req.seminar_schedule.supervisor_bimbingan.supervisors
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

                    {/* Documents Incomplete */}
                    {!req.documents.completed && (
                        <Alert variant="default" className="border-amber-500 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800">⚠️ Dokumen Belum Lengkap</AlertTitle>
                            <AlertDescription className="text-amber-700">
                                Untuk melanjutkan ke fase <strong>{PHASE_LABELS[req.next_phase] || req.next_phase}</strong>,
                                dokumen berikut harus diupload dan disetujui:
                                <ul className="mt-2 list-disc pl-4 space-y-1">
                                    {req.documents.pending_types.map((type) => (
                                        <li key={type}>{type}</li>
                                    ))}
                                </ul>
                                <p className="mt-2 text-sm">
                                    Progress: {req.documents.approved_count}/{req.documents.total_required} dokumen disetujui
                                </p>
                            </AlertDescription>
                        </Alert>
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
                                                {block.supervisors
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

                {/* Final UI-only gate: Ready for TA Individual */}
                {workflow?.final_ready_for_ta_individual && (
                        workflow.final_ready_for_ta_individual.ready ? (
                            <Alert variant="default" className="border-green-500 bg-green-50">
                                <Check className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800">✅ Ready for TA Individual</AlertTitle>
                                <AlertDescription className="text-green-700">
                                    Semua syarat akhir terpenuhi (dokumen EXPO, NILAI_DOSEN, MILESTONE, evaluasi EXPO, dan peer review lengkap).
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert variant="default" className="border-amber-500 bg-amber-50">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">🔒 Belum Ready for TA Individual</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                    {!workflow.final_ready_for_ta_individual.expo_documents.completed && (
                                        <div className="mb-2">
                                            <p className="font-medium">Dokumen EXPO belum lengkap/disetujui:</p>
                                            <ul className="mt-1 list-disc pl-5 space-y-1">
                                                {workflow.final_ready_for_ta_individual.expo_documents.pending_types.map((t) => (
                                                    <li key={t}>{t}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {!workflow.final_ready_for_ta_individual.milestone.configured && (
                                        <p className="mb-2">Komponen MILESTONE belum dikonfigurasi admin untuk periode ini.</p>
                                    )}
                                    {!workflow.final_ready_for_ta_individual.nilai_dosen.configured && (
                                        <p className="mb-2">Komponen NILAI_DOSEN belum dikonfigurasi admin untuk periode ini.</p>
                                    )}
                                    {!workflow.final_ready_for_ta_individual.expo_evaluation.configured && (
                                        <p className="mb-2">Komponen evaluasi EXPO belum dikonfigurasi admin untuk periode ini.</p>
                                    )}
                                    {workflow.final_ready_for_ta_individual.nilai_dosen.configured && !workflow.final_ready_for_ta_individual.nilai_dosen.completed && (
                                        <div className="mb-2">
                                            <p className="font-medium">Menunggu NILAI_DOSEN dosen pembimbing:</p>
                                            <ul className="mt-1 space-y-1">
                                                {workflow.final_ready_for_ta_individual.nilai_dosen.supervisors
                                                    .filter((s) => s.status === 'pending')
                                                    .map((s) => (
                                                        <li key={s.id}>
                                                            {s.name} ({s.role === 'SUPERVISOR_1' ? 'Pembimbing 1' : 'Pembimbing 2'})
                                                            <span className="text-sm text-muted-foreground ml-2">
                                                                - {s.submitted_components}/{s.total_components} komponen
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                    {workflow.final_ready_for_ta_individual.milestone.configured && !workflow.final_ready_for_ta_individual.milestone.completed && (
                                        <div className="mb-2">
                                            <p className="font-medium">Menunggu penilaian MILESTONE dosen pembimbing:</p>
                                            <ul className="mt-1 space-y-1">
                                                {workflow.final_ready_for_ta_individual.milestone.supervisors
                                                    .filter((s) => s.status === 'pending')
                                                    .map((s) => (
                                                        <li key={s.id}>
                                                            {s.name} ({s.role === 'SUPERVISOR_1' ? 'Pembimbing 1' : 'Pembimbing 2'})
                                                            <span className="text-sm text-muted-foreground ml-2">
                                                                - {s.submitted_components}/{s.total_components} komponen
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                    {workflow.final_ready_for_ta_individual.expo_evaluation.configured && !workflow.final_ready_for_ta_individual.expo_evaluation.completed && (
                                        <div className="mb-2">
                                            <p className="font-medium">Menunggu evaluasi EXPO dari dosen pembimbing:</p>
                                            <ul className="mt-1 space-y-1">
                                                {workflow.final_ready_for_ta_individual.expo_evaluation.supervisors
                                                    .filter((s) => s.status === 'pending')
                                                    .map((s) => (
                                                        <li key={s.id}>
                                                            {s.name} ({s.role === 'SUPERVISOR_1' ? 'Pembimbing 1' : 'Pembimbing 2'})
                                                            <span className="text-sm text-muted-foreground ml-2">
                                                                - {s.submitted_components}/{s.total_components} komponen
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                    {!workflow.final_ready_for_ta_individual.peer_review.configured && (
                                        <p className="mb-2">Indikator peer review belum diset oleh admin pada Evaluation Setup.</p>
                                    )}
                                    {workflow.final_ready_for_ta_individual.peer_review.configured && !workflow.final_ready_for_ta_individual.peer_review.completed && (
                                        <div>
                                            <p className="font-medium">Peer review belum lengkap:</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Progress: {workflow.final_ready_for_ta_individual.peer_review.completed_members}/{workflow.final_ready_for_ta_individual.peer_review.total_members} mahasiswa selesai.
                                            </p>
                                            <ul className="mt-1 space-y-1">
                                                {workflow.final_ready_for_ta_individual.peer_review.incomplete_students.map((s) => (
                                                    <li key={s.student_id}>
                                                        {s.student_name} ({s.student_nim})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )
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

                    {/* Horizontal stepper on desktop, vertical on mobile */}
                    <div className="relative">
                        {stepCount > 1 && (
                            <div
                                className="hidden md:block absolute top-6 h-0.5 bg-muted z-0"
                                style={{
                                    left: `${50 / stepCount}%`,
                                    right: `${50 / stepCount}%`,
                                }}
                            />
                        )}
                        <div
                            className={cn(
                                'grid grid-cols-1 gap-4 relative z-10',
                                DESKTOP_GRID_COLS_CLASS[stepCount] || 'md:grid-cols-6'
                            )}
                        >
                            {stepperPhases.map((phaseInfo) => {
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
                                        {!phaseInfo.ui_only && phaseInfo.required_types.length > 1 && (
                                            <div className="flex flex-col gap-1 mt-2 w-full px-2">
                                                {phaseInfo.documents.map(d => {
                                                    const semproSchedule = workflow?.next_phase_requirements?.seminar_schedule;
                                                    const semproBlocked = phaseInfo.phase === 'SEMPRO' && !semproSchedule?.exists;
                                                    const canUploadType = phaseInfo.status !== 'locked' && d.status !== 'APPROVED' && !semproBlocked;
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
                                                            {semproBlocked && (
                                                                <span className="text-[10px] text-amber-600 mt-1">Menunggu jadwal</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {(phaseInfo.ui_only || phaseInfo.required_types.length <= 1) && (
                                            <p className="text-xs text-muted-foreground capitalize mt-0.5">{phaseInfo.status}</p>
                                        )}
                                        {/* Single document phase upload button */}
                                        {!phaseInfo.ui_only && phaseInfo.required_types.length <= 1 && phaseInfo.status !== 'locked' && phaseInfo.status !== 'completed' && (
                                            (() => {
                                                const semproSchedule = workflow?.next_phase_requirements?.seminar_schedule;
                                                const semproBlocked = phaseInfo.phase === 'SEMPRO' && !semproSchedule?.exists;
                                                return (
                                                    <Button 
                                                        size="sm" 
                                                        className="mt-2 text-xs h-7" 
                                                        onClick={() => openUploadDialog(phaseInfo.phase, phaseInfo.required_types[0] || 'GENERAL')}
                                                        disabled={semproBlocked}
                                                    >
                                                        <Upload className="mr-1 h-3 w-3" /> 
                                                        {semproBlocked ? 'Menunggu Jadwal' : 'Upload'}
                                                    </Button>
                                                );
                                            })()
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
