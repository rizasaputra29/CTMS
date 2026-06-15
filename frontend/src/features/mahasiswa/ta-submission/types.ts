export interface Group {
  id: number;
  name?: string;
  code?: string;
  title: { title: string } | null;
  supervisor1?: { name: string } | null;
  supervisor2?: { name: string } | null;
}

export interface Document {
  id: number;
  document_type: string;
  file_path: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  feedback: string | null;
  reviewed_by: number | null;
}

export interface DocumentRequirement {
  id: number;
  name: string;
  description: string | null;
  is_required: boolean;
}

export interface TaSubmission {
  id: number;
  status: string;
  file_path: string | null;
  feedback: string | null;
  reviewer: { name: string } | null;
}

export interface TaStatusResponse {
  can_access: boolean;
  status: string;
  submission: TaSubmission | null;
  group: Group | null;
  documents: Document[];
  document_requirements: DocumentRequirement[];
}

export interface DefenseSchedule {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  room: string;
  status: 'SCHEDULED' | 'DONE' | 'CANCELLED';
  examiner1?: { name: string } | null;
  examiner2?: { name: string } | null;
  evaluation_deadline?: string;
  notes?: string;
}

export interface EvaluatorDetail {
  name: string;
  role: string;
  score: number | null;
  component: string;
}

export interface ComponentDetail {
  score: number | null;
  evaluators: EvaluatorDetail[];
}

export interface GradeSection {
  grade: number;
  components: Record<string, ComponentDetail>;
  component_count: number;
  status: string;
}

export interface GradeData {
  ta: GradeSection | null;
}

export interface SupervisorStatus {
  id: number;
  name: string;
  role: string;
  status: string;
  submitted_components?: number;
  total_components?: number;
}

export interface PeerReviewInfo {
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
}

export interface FinalReadyInfo {
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
  peer_review: PeerReviewInfo;
}

export interface WorkflowData {
  final_ready_for_ta_individual?: FinalReadyInfo | null;
}
