'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ElementType } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/error-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileCheck, Upload, Info, Lock, CheckCircle, AlertCircle, AlertTriangle,
  FileText, Calendar, GraduationCap, User, Users, Clock, MapPin, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TaStatusResponse, DefenseSchedule, GradeSection, WorkflowData } from '../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ElementType; description: string }> = {
  TA_LOCKED: { 
    label: 'Locked', 
    color: 'bg-gray-100 text-gray-800', 
    icon: Lock,
    description: 'TA phase is locked. Complete EXPO first.'
  },
  TA_DOCUMENTS_REQUIRED: { 
    label: 'Documents Required', 
    color: 'bg-blue-100 text-blue-800', 
    icon: FileText,
    description: 'Upload all required TA documents to proceed.'
  },
  TA_DOCUMENTS_UNDER_REVIEW: { 
    label: 'Under Review', 
    color: 'bg-yellow-100 text-yellow-800', 
    icon: Clock,
    description: 'Documents submitted. Waiting for supervisor approval.'
  },
  TA_DOCUMENTS_APPROVED: { 
    label: 'Documents Approved', 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle,
    description: 'All documents approved! Waiting for sidang schedule.'
  },
  TA_DRAFT: { 
    label: 'Draft Uploaded', 
    color: 'bg-primary-100 text-primary-500', 
    icon: FileText,
    description: 'TA draft uploaded and under review.'
  },
  TA_REVISED: { 
    label: 'Revision Submitted', 
    color: 'bg-orange-100 text-orange-800', 
    icon: FileText,
    description: 'Revision submitted. Waiting for review.'
  },
  TA_READY: { 
    label: 'Ready for Defense', 
    color: 'bg-emerald-100 text-emerald-800', 
    icon: CheckCircle,
    description: 'TA approved! You can now register for defense.'
  },
  TA_READY_FOR_SIDANG: { 
    label: 'Ready for Sidang', 
    color: 'bg-indigo-100 text-indigo-800', 
    icon: Calendar,
    description: 'Sidang scheduled. Prepare for your defense.'
  },
  TA_REGISTERED: { 
    label: 'Registered', 
    color: 'bg-cyan-100 text-cyan-800', 
    icon: FileCheck,
    description: 'Registered for TA defense.'
  },
  TA_SCHEDULED: { 
    label: 'Scheduled', 
    color: 'bg-primary-100 text-primary-500', 
    icon: Calendar,
    description: 'TA defense has been scheduled.'
  },
  TA_DEFENDED: { 
    label: 'Completed', 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle,
    description: 'Congratulations! TA defense completed.'
  },
};

const STEPS = [
  { id: 'documents', label: 'Upload Documents', description: 'Submit all required documents' },
  { id: 'review', label: 'Document Review', description: 'Supervisor review in progress' },
  { id: 'approved', label: 'Documents Approved', description: 'Ready for scheduling' },
  { id: 'schedule', label: 'Sidang Scheduled', description: 'Defense date confirmed' },
  { id: 'defense', label: 'Defense Complete', description: 'TA defense finished' },
];

export function TaSubmissionFeature() {
  const { user } = useAuth();
  const [statusData, setStatusData] = useState<TaStatusResponse | null>(null);
  const [defenseSchedule, setDefenseSchedule] = useState<DefenseSchedule | null>(null);
  const [gradesData, setGradesData] = useState<GradeSection | null>(null);
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [taRes, workflowRes] = await Promise.all([
        api.get('/mahasiswa/ta-detailed-status'),
        api.get('/mahasiswa/workflow').catch(() => ({ data: null })),
      ]);
      setStatusData(taRes.data?.data ?? taRes.data);
      setWorkflowData(workflowRes.data?.data ?? workflowRes.data);
    } catch (err: unknown) {
      console.error('Failed to fetch TA data', err);
      if (api.isAxiosError(err) && err.response?.status === 400) {
        setStatusData({
          can_access: false,
          status: 'TA_LOCKED',
          submission: null,
          group: null,
          documents: [],
          document_requirements: [],
        });
      } else {
        toast.error('Failed to load TA data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch defense schedule when status indicates scheduling
  const fetchDefenseSchedule = useCallback(async () => {
    const scheduledStatuses = ['TA_READY_FOR_SIDANG', 'TA_REGISTERED', 'TA_SCHEDULED', 'TA_DEFENDED'];
    if (!statusData?.status || !scheduledStatuses.includes(statusData.status)) {
      setDefenseSchedule(null);
      return;
    }

    try {
      setScheduleLoading(true);
      const response = await api.get('/mahasiswa/ta-defense-schedules/my-schedule');
      const schedules = response.data?.data || [];
      // Get the first active schedule (SCHEDULED or DONE)
      const activeSchedule = schedules.find((s: DefenseSchedule) =>
        s.status === 'SCHEDULED' || s.status === 'DONE'
      );
      setDefenseSchedule(activeSchedule || null);
    } catch (err) {
      console.error('Failed to fetch defense schedule', err);
      setDefenseSchedule(null);
    } finally {
      setScheduleLoading(false);
    }
  }, [statusData?.status]);

  // Fetch grades when defense is complete
  const fetchGrades = useCallback(async () => {
    const completionStatuses = ['TA_DEFENDED', 'TA_REVISED'];
    if (!statusData?.status || !completionStatuses.includes(statusData.status)) {
      setGradesData(null);
      return;
    }

    try {
      setGradesLoading(true);
      const response = await api.get('/mahasiswa/my-grades');
      const responseData = response.data?.data ?? response.data;
      const grades: { ta: GradeSection | null } | null = responseData?.grades || null;
      setGradesData(grades?.ta || null);
    } catch (err) {
      console.error('Failed to fetch grades', err);
      setGradesData(null);
    } finally {
      setGradesLoading(false);
    }
  }, [statusData?.status]);

  // Fetch data on initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch defense schedule when status changes
  useEffect(() => {
    fetchDefenseSchedule();
  }, [fetchDefenseSchedule]);

  // Fetch grades when status changes to DEFENDED or REVISED
  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a PDF, DOC, or DOCX file');
        return;
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedDocType) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('document_type', selectedDocType);

    try {
      await api.post('/mahasiswa/ta-documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });
      
      toast.success('Document uploaded successfully');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedDocType('');
      fetchData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error) || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const openUploadDialog = (docType: string) => {
    setSelectedDocType(docType);
    setSelectedFile(null);
    setUploadDialogOpen(true);
  };

  const getCurrentStepIndex = () => {
    if (!statusData) return 0;
    const currentStatus = statusData.status;
    
    // Map status to step index
    if (['TA_DOCUMENTS_REQUIRED'].includes(currentStatus)) return 0;
    if (['TA_DOCUMENTS_UNDER_REVIEW'].includes(currentStatus)) return 1;
    if (['TA_DOCUMENTS_APPROVED'].includes(currentStatus)) return 2;
    if (['TA_READY_FOR_SIDANG', 'TA_REGISTERED'].includes(currentStatus)) return 3;
    if (['TA_SCHEDULED', 'TA_DEFENDED'].includes(currentStatus)) return 4;
    return 0;
  };

  const getDocumentStatus = (documentType: string) => {
    if (!statusData) return null;
    return (statusData.documents ?? []).find(d => d.document_type === documentType);
  };

  const getApprovedCount = () => {
    if (!statusData) return 0;
    return (statusData.documents ?? []).filter(d => d.status === 'APPROVED').length;
  };

  const getRequiredCount = () => {
    if (!statusData) return 0;
    return (statusData.document_requirements ?? []).filter(r => r.is_required).length;
  };

  // Helper functions for grade display
  const getLetterGrade = (score: number): string => {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'E';
  };

  const getGradeColor = (score: number) => {
    if (score >= 85) return { text: 'text-emerald-700', bg: 'bg-emerald-100', bar: 'bg-emerald-500' };
    if (score >= 70) return { text: 'text-sky-700', bg: 'bg-sky-100', bar: 'bg-sky-500' };
    if (score >= 60) return { text: 'text-amber-700', bg: 'bg-amber-100', bar: 'bg-amber-500' };
    if (score >= 50) return { text: 'text-orange-700', bg: 'bg-orange-100', bar: 'bg-orange-500' };
    return { text: 'text-rose-700', bg: 'bg-rose-100', bar: 'bg-rose-500' };
  };

  const roleLabels: Record<string, string> = {
    EXAMINER_1: 'Penguji 1',
    EXAMINER_2: 'Penguji 2',
    EXAMINER: 'Penguji',
    SUPERVISOR_1: 'Pembimbing 1',
    SUPERVISOR_2: 'Pembimbing 2',
    UNKNOWN: 'Evaluator',
  };

    if (loading) return <Loading variant="section" />;

  // TA Locked State
  if (!statusData || !statusData.can_access || statusData.status === 'TA_LOCKED') {
    const readiness = workflowData?.final_ready_for_ta_individual;

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tugas Akhir (TA)</h1>
          <p className="text-muted-foreground">Individual thesis phase.</p>
        </div>

        {readiness ? (
          <Alert variant="default" className="border-amber-500 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">🔒 Belum Ready for TA Individual</AlertTitle>
            <AlertDescription className="text-amber-700">
              {!readiness.expo_documents.completed && (
                <div className="mb-2">
                  <p className="font-medium">Dokumen EXPO belum lengkap/disetujui:</p>
                  <ul className="mt-1 list-disc pl-5 space-y-1">
                    {(readiness.expo_documents.pending_types ?? []).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!readiness.milestone.configured && (
                <p className="mb-2">Komponen MILESTONE belum dikonfigurasi admin untuk periode ini.</p>
              )}
              {!readiness.nilai_dosen.configured && (
                <p className="mb-2">Komponen NILAI_DOSEN belum dikonfigurasi admin untuk periode ini.</p>
              )}
              {!readiness.expo_evaluation.configured && (
                <p className="mb-2">Komponen evaluasi EXPO belum dikonfigurasi admin untuk periode ini.</p>
              )}
              {readiness.nilai_dosen.configured && !readiness.nilai_dosen.completed && (
                <div className="mb-2">
                  <p className="font-medium">Menunggu NILAI_DOSEN dosen pembimbing:</p>
                  <ul className="mt-1 space-y-1">
                    {(readiness.nilai_dosen.supervisors ?? [])
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
              {readiness.milestone.configured && !readiness.milestone.completed && (
                <div className="mb-2">
                  <p className="font-medium">Menunggu penilaian MILESTONE dosen pembimbing:</p>
                  <ul className="mt-1 space-y-1">
                    {(readiness.milestone.supervisors ?? [])
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
              {readiness.expo_evaluation.configured && !readiness.expo_evaluation.completed && (
                <div className="mb-2">
                  <p className="font-medium">Menunggu evaluasi EXPO dari dosen pembimbing:</p>
                  <ul className="mt-1 space-y-1">
                    {(readiness.expo_evaluation.supervisors ?? [])
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
              {!readiness.peer_review.configured && (
                <p className="mb-2">Indikator peer review belum diset oleh admin pada Evaluation Setup.</p>
              )}
              {readiness.peer_review.configured && !readiness.peer_review.completed && (
                <div>
                  <p className="font-medium">Peer review belum lengkap:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Progress: {readiness.peer_review.completed_members}/{readiness.peer_review.total_members} mahasiswa selesai.
                  </p>
                  <ul className="mt-1 space-y-1">
                    {(readiness.peer_review.incomplete_students ?? []).map((s) => (
                      <li key={s.student_id}>
                        {s.student_name} ({s.student_nim})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-800">TA Phase Locked</CardTitle>
              </div>
              <CardDescription className="text-red-700">
                TA phase is currently locked.
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
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const currentStatus = statusData.status;
  const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.TA_LOCKED;
  const StatusIcon = statusConfig.icon;
  const currentStep = getCurrentStepIndex();
  const approvedCount = getApprovedCount();
  const requiredCount = getRequiredCount();
  const progressPercentage = requiredCount > 0 ? (approvedCount / requiredCount) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tugas Akhir (TA)</h1>
          <p className="text-muted-foreground">Individual thesis submission and defense.</p>
        </div>
        <Badge className={`${statusConfig.color} px-3 py-1 text-sm font-medium`}>
          <StatusIcon className="w-4 h-4 mr-1" />
          {statusConfig.label}
        </Badge>
      </div>

      {/* Student Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Student Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {user?.name?.charAt(0) || 'S'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg">{user?.name || 'Student'}</p>
                <p className="text-sm text-muted-foreground">Individual TA Phase</p>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden md:block h-16" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Group</p>
                <p className="font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Group {statusData.group?.id || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium truncate">
                  {statusData.group?.title?.title || 'No title assigned'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supervisor 1</p>
                <p className="font-medium">
                  {statusData.group?.supervisor1?.name || 'Not assigned'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supervisor 2</p>
                <p className="font-medium">
                  {statusData.group?.supervisor2?.name || 'Not assigned'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Stepper - Grid Based Responsive */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Progress Overview</CardTitle>
          <CardDescription>Track your TA submission progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Connecting Line - Desktop */}
            <div className="hidden md:block absolute top-6 left-0 right-0 h-0.5 bg-muted" />
            
            {/* Steps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-2">
              {STEPS.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                // const isPending = index > currentStep;

                return (
                  <div key={step.id} className="relative flex md:flex-col items-start md:items-center gap-3 md:gap-2">
                    {/* Step Circle */}
                    <div 
                      className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : isCurrent
                            ? 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20'
                            : 'bg-background border-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    
                    {/* Step Info */}
                    <div className="flex-1 md:text-center">
                      <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground hidden md:block">
                        {step.description}
                      </p>
                    </div>
                    
                    {/* Mobile connecting line */}
                    {index < STEPS.length - 1 && (
                      <div className={`md:hidden absolute left-6 top-12 w-0.5 h-full ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Alert */}
      <Alert className={`${statusConfig.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-10 ')}`}>
        <StatusIcon className="h-4 w-4" />
        <AlertTitle className="font-semibold">{statusConfig.label}</AlertTitle>
        <AlertDescription>{statusConfig.description}</AlertDescription>
      </Alert>

      {/* Documents Section */}
      {['TA_DOCUMENTS_REQUIRED', 'TA_DOCUMENTS_UNDER_REVIEW', 'TA_DOCUMENTS_APPROVED'].includes(currentStatus) && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Required Documents
                </CardTitle>
                <CardDescription>
                  Upload all required documents to proceed to sidang TA
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {approvedCount} / {requiredCount} Approved
                </p>
                <div className="w-32 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {statusData.document_requirements.length === 0 ? (
              <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle>No Document Requirements</AlertTitle>
                <AlertDescription>
                  No TA document requirements have been configured for this period. Please contact your administrator.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {(statusData.document_requirements ?? [])
                  .filter(req => req.is_required)
                  .map((req) => {
                    const doc = getDocumentStatus(req.name);
                    const isUploaded = !!doc;
                    const isApproved = doc?.status === 'APPROVED';
                    const isRejected = doc?.status === 'REJECTED';
                    const isPending = doc?.status === 'PENDING';

                    return (
                      <div 
                        key={req.id} 
                        className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                          isApproved ? 'bg-green-50 border-green-200' :
                          isRejected ? 'bg-red-50 border-red-200' :
                          isPending ? 'bg-yellow-50 border-yellow-200' :
                          'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`mt-0.5 ${
                            isApproved ? 'text-green-600' :
                            isRejected ? 'text-red-600' :
                            isPending ? 'text-yellow-600' :
                            'text-gray-400'
                          }`}>
                            {isApproved ? <CheckCircle className="w-5 h-5" /> :
                             isRejected ? <AlertCircle className="w-5 h-5" /> :
                             isPending ? <Clock className="w-5 h-5" /> :
                             <FileText className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{req.name}</p>
                              {isApproved && <Badge className="bg-green-100 text-green-800 text-xs">Approved</Badge>}
                              {isRejected && <Badge className="bg-red-100 text-red-800 text-xs">Rejected</Badge>}
                              {isPending && <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pending Review</Badge>}
                            </div>
                            {req.description && (
                              <p className="text-sm text-muted-foreground">{req.description}</p>
                            )}
                            {isRejected && doc?.feedback && (
                              <div className="mt-2 text-sm text-red-700 bg-red-100 p-2 rounded">
                                <span className="font-semibold">Feedback:</span> {doc.feedback}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          {!isApproved && (
                            <Button 
                              size="sm"
                              onClick={() => openUploadDialog(req.name)}
                              disabled={uploading}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {isUploaded ? 'Update' : 'Upload'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents Approved - Waiting for Schedule */}
      {currentStatus === 'TA_DOCUMENTS_APPROVED' && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              Documents Approved!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700">
              All your TA documents have been approved. You are now waiting for the administrator to schedule your sidang TA.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sidang Scheduled/Completed Section */}
      {['TA_READY_FOR_SIDANG', 'TA_REGISTERED', 'TA_SCHEDULED', 'TA_DEFENDED', 'TA_REVISED'].includes(currentStatus) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              {['TA_DEFENDED', 'TA_REVISED'].includes(currentStatus) ? 'Hasil Sidang TA' : 'Sidang TA'}
            </CardTitle>
            <CardDescription>
              {['TA_DEFENDED', 'TA_REVISED'].includes(currentStatus) 
                ? 'Nilai dan evaluasi sidang tugas akhir Anda' 
                : 'Your thesis defense schedule and information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Loading states */}
            {(scheduleLoading || gradesLoading) && (
              <Loading variant="inline" />
            )}

            {/* Completed state with scores */}
            {!scheduleLoading && !gradesLoading && ['TA_DEFENDED', 'TA_REVISED'].includes(currentStatus) && gradesData && (
              <div className="space-y-6">
                {/* Final Score Display */}
                <div className="bg-gradient-to-r from-emerald-50 to-sky-50 border border-emerald-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Nilai Akhir</p>
                      <div className="flex items-baseline gap-3">
                        <span className={`text-4xl font-bold ${getGradeColor(Number(gradesData.grade)).text}`}>
                          {Number(gradesData.grade).toFixed(2)}
                        </span>
                        <span className={`text-xl font-semibold px-3 py-1 rounded-lg ${getGradeColor(Number(gradesData.grade)).bg} ${getGradeColor(Number(gradesData.grade)).text}`}>
                          {getLetterGrade(Number(gradesData.grade))}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={gradesData.status === 'COMPLETE' ? 'default' : 'secondary'}>
                        {gradesData.status === 'COMPLETE' ? 'Selesai' : 'Dalam Proses'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getGradeColor(Number(gradesData.grade)).bar} transition-all duration-700`}
                        style={{ width: `${Math.min(100, Math.max(0, Number(gradesData.grade)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* SIDANG_TA Scores */}
                {gradesData.components.SIDANG_TA && (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Nilai Penguji (SIDANG_TA)
                    </h4>
                    <div className="space-y-2">
                      {(gradesData.components.SIDANG_TA.evaluators ?? []).map((evaluator, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{evaluator.name}</span>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {roleLabels[evaluator.role] || evaluator.role}
                            </Badge>
                          </div>
                          <span className={`text-sm font-semibold ${evaluator.score !== null && evaluator.score !== undefined ? getGradeColor(Number(evaluator.score)).text : 'text-gray-400'}`}>
                            {evaluator.score !== null && evaluator.score !== undefined ? Number(evaluator.score).toFixed(1) : '-'}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <span className="text-sm font-medium text-emerald-800">Rata-rata Penguji</span>
                        <span className="text-sm font-bold text-emerald-700">
                          {gradesData.components.SIDANG_TA.score !== null && gradesData.components.SIDANG_TA.score !== undefined ? Number(gradesData.components.SIDANG_TA.score).toFixed(1) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* BIMBINGAN_TA Scores */}
                {gradesData.components.BIMBINGAN_TA && (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                      Nilai Pembimbing (BIMBINGAN_TA)
                    </h4>
                    <div className="space-y-2">
                      {(gradesData.components.BIMBINGAN_TA.evaluators ?? []).map((evaluator, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{evaluator.name}</span>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              {roleLabels[evaluator.role] || evaluator.role}
                            </Badge>
                          </div>
                          <span className={`text-sm font-semibold ${evaluator.score !== null && evaluator.score !== undefined ? getGradeColor(Number(evaluator.score)).text : 'text-gray-400'}`}>
                            {evaluator.score !== null && evaluator.score !== undefined ? Number(evaluator.score).toFixed(1) : '-'}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 bg-sky-50 rounded-lg border border-sky-200">
                        <span className="text-sm font-medium text-sky-800">Rata-rata Pembimbing</span>
                        <span className="text-sm font-bold text-sky-700">
                          {gradesData.components.BIMBINGAN_TA.score !== null && gradesData.components.BIMBINGAN_TA.score !== undefined ? Number(gradesData.components.BIMBINGAN_TA.score).toFixed(1) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Defense Schedule Summary (Collapsible) - shown when completed */}
                {defenseSchedule && (
                  <details className="border rounded-lg">
                    <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                      Lihat Jadwal Sidang
                    </summary>
                    <div className="px-4 pb-4 pt-2 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {formatDate(defenseSchedule.date)}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4" />
                        {defenseSchedule.start_time} - {defenseSchedule.end_time}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {defenseSchedule.room}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Pre-defense state with schedule */}
            {!scheduleLoading && !gradesLoading && !['TA_DEFENDED', 'TA_REVISED'].includes(currentStatus) && defenseSchedule && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">
                      {formatDate(defenseSchedule.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-800">
                      {defenseSchedule.start_time} - {defenseSchedule.end_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-800">{defenseSchedule.room}</span>
                  </div>
                  <Separator className="bg-blue-200" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-blue-900">Penguji:</p>
                    <div className="text-sm text-blue-800">
                      1. {defenseSchedule.examiner1?.name || 'TBA'}
                    </div>
                    <div className="text-sm text-blue-800">
                      2. {defenseSchedule.examiner2?.name || 'TBA'}
                    </div>
                  </div>
                  {defenseSchedule.evaluation_deadline && (
                    <>
                      <Separator className="bg-blue-200" />
                      <div className="text-xs text-blue-700">
                        Tenggat evaluasi: {formatDate(defenseSchedule.evaluation_deadline)}
                      </div>
                    </>
                  )}
                  </div>
                </>
              )}
            {/* No schedule found */}
            {!scheduleLoading && !gradesLoading && !['TA_DEFENDED', 'TA_REVISED'].includes(currentStatus) && !defenseSchedule && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <Info className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Informasi Jadwal</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  Sidang TA Anda telah dijadwalkan. Silakan cek halaman jadwal untuk detail lengkap.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload {selectedDocType} for TA submission
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="file">Document File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, DOC, DOCX. Max size: 10MB
              </p>
            </div>
            
            {selectedFile && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Selected file:</p>
                <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
            
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Upload all required documents to proceed to sidang TA.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Documents must be approved by your supervisors before scheduling.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Contact your supervisor for guidance during the TA phase.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
