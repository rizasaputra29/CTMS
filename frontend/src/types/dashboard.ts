/**
 * Dashboard Type Definitions
 * Dashboard-specific data structures and statistics
 */

import type { EvaluationWithSupervisors } from './evaluation';
import type { SupervisorInEvaluation } from './user';
import type { LatestDocument } from './document';
import type { GroupStatus } from './group';

/**
 * Workflow phase status
 */
export type WorkflowPhaseStatus =
  | 'locked'
  | 'unlocked'
  | 'submitted'
  | 'draft'
  | 'revision'
  | 'completed';

/**
 * Workflow phase
 */
export interface WorkflowPhase {
  phase: string;
  status: WorkflowPhaseStatus;
  documents: Array<{
    type: string;
    status: 'missing' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    latest_document?: LatestDocument | null;
  }>;
  required_types: string[];
  document_count: number;
}

/**
 * Workflow data
 */
export interface WorkflowData {
  phases: WorkflowPhase[];
  current_phase: string | null;
  is_graduated: boolean;
}

/**
 * Seminar schedule in next phase requirements
 */
export interface NextPhaseSeminarSchedule {
  exists: boolean;
  date?: string;
  room?: string;
  start_time?: string;
  end_time?: string;
  examiners?: Array<{ id: number; name: string }>;
  status?: string;
  examiner_evaluations?: {
    required: boolean;
    configured: boolean;
    completed: boolean;
    submitted?: number;
    total?: number;
    pending?: number;
    examiners?: Array<{
      id: number;
      name: string;
      has_submitted: boolean;
    }>;
  };
  supervisor_bimbingan?: {
    supervisors: SupervisorInEvaluation[];
  };
  is_ready_for_pdc2?: boolean;
  message?: string;
}

/**
 * Next phase requirements
 */
export interface NextPhaseRequirements {
  current_phase: string;
  next_phase: string;
  documents: {
    completed: boolean;
    total_required: number;
    approved_count: number;
    pending_types: string[];
  };
  supervisor_evaluation?: EvaluationWithSupervisors | null;
  supervisor_evaluations?: EvaluationWithSupervisors[];
  seminar_schedule?: NextPhaseSeminarSchedule;
}

/**
 * Final ready status for TA individual
 */
export interface FinalReadyStatus {
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
    supervisors: SupervisorInEvaluation[];
  };
  milestone: {
    required: boolean;
    configured: boolean;
    completed: boolean;
    component_count: number;
    supervisors: SupervisorInEvaluation[];
  };
  expo_evaluation: {
    required: boolean;
    configured: boolean;
    completed: boolean;
    component_count: number;
    supervisors: SupervisorInEvaluation[];
  };
  peer_review: {
    required: boolean;
    configured: boolean;
    completed: boolean;
    indicator_count: number;
    total_members: number;
    completed_members: number;
  };
}

/**
 * Mahasiswa dashboard statistics
 */
export interface MahasiswaStats {
  has_group: boolean;
  group_status: GroupStatus | null;
  title: string | null;
  group_period: { name: string } | null;
  active_periods: Array<{ id: number; name: string }>;
  steps: Record<string, boolean>;
  is_graduated: boolean;
  upcoming_schedules?: Array<{
    id: number;
    type: string;
    date: string;
    start_time?: string;
    end_time?: string;
    room: string;
    status: string;
  }>;
  workflow?: WorkflowData;
  next_phase_requirements?: NextPhaseRequirements | null;
  final_ready_for_ta_individual?: FinalReadyStatus;
}

/**
 * Dosen dashboard statistics
 */
export interface DosenStats {
  supervised_groups: number;
  pending_evaluations: number;
  pending_bids: number;
  upcoming_schedules: number;
  recent_submissions: Array<{
    id: number;
    label: string;
    subtitle?: string;
    status: {
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
    };
    href: string;
  }>;
}

/**
 * Admin dashboard statistics
 */
export interface AdminStats {
  total_periods: number;
  total_users: number;
  total_groups: number;
  pending_finalization: number;
  recent_groups: Array<{
    id: number;
    label: string;
    subtitle: string;
    status: {
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
    };
    href: string;
  }>;
}

/**
 * Dashboard stats card data
 */
export interface DashboardStatsCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: string;
    positive: boolean;
  };
  href?: string;
}

/**
 * Dashboard recent item
 */
export interface DashboardRecentItem {
  id: string | number;
  label: string;
  subtitle?: string;
  status?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  href?: string;
  timestamp?: string;
}

/**
 * Dashboard quick action
 */
export interface DashboardQuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

/**
 * Recent list props
 */
export interface RecentListProps {
  items: DashboardRecentItem[];
  title?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyMessage?: string;
  className?: string;
}
