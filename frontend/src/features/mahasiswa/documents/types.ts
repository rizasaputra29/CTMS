export interface Document {
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

export interface PhaseDocumentType {
    type: string;
    status: string;
    latest_document: Document | null;
}

export interface PhaseInfo {
    phase: string;
    status: 'locked' | 'unlocked' | 'submitted' | 'draft' | 'revision' | 'completed';
    documents: PhaseDocumentType[];
    required_types: string[];
    document_count: number;
}

export interface SupervisorStatus {
    id: number;
    name: string;
    role: string;
    status: 'completed' | 'pending';
    submitted_components: number;
    total_components: number;
}

export interface ExaminerInfo {
    id: number;
    name: string;
}

export interface ExaminerEvaluationStatus {
    id: number;
    name: string;
    status: string;
}

export interface ExaminerEvaluationsInfo {
    total: number;
    submitted: number;
    pending: number;
    examiners: ExaminerEvaluationStatus[];
}

export interface SupervisorBimbinganStatus {
    id: number;
    name: string;
    role: string;
    status: 'completed' | 'pending';
    submitted_components?: number;
    total_components?: number;
}

export interface SupervisorBimbinganInfo {
    required: boolean;
    evaluation_type: string;
    component_count?: number;
    all_submitted?: boolean;
    supervisors: SupervisorBimbinganStatus[];
}

export interface SeminarScheduleInfo {
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

export interface NextPhaseRequirements {
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

export interface WorkflowData {
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

export const PHASE_LABELS: Record<string, string> = {
    'PDC1': 'PDC 1',
    'SEMPRO': 'Seminar Proposal',
    'PDC2': 'PDC 2',
    'TA_DRAFT': 'TA Draft',
    'EXPO': 'Expo',
    'TA_INDIVIDUAL_READY': 'Ready for TA Individual',
};
