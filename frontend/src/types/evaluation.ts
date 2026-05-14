/**
 * Evaluation Type Definitions
 * Evaluation, grading, and assessment types
 */

import type { SupervisorInEvaluation } from './user';

/**
 * Evaluation status types
 */
export type EvaluationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'not_started'
  | 'overdue';

/**
 * Evaluation component status
 */
export interface EvaluationComponentStatus {
  id: number;
  name: string;
  status: EvaluationStatus;
  score?: number;
  max_score?: number;
  submitted_at?: string;
}

/**
 * Evaluation with supervisors
 * Used in dashboard to show evaluation status per supervisor
 */
export interface EvaluationWithSupervisors {
  evaluation_type: string;
  required: boolean;
  configured: boolean;
  completed: boolean;
  component_count: number;
  supervisors: SupervisorInEvaluation[];
}

/**
 * Supervisor evaluation detail
 * Used in evaluation pages
 */
export interface SupervisorEvaluation {
  id: number;
  supervisor_id: number;
  supervisor_name: string;
  evaluation_type: string;
  status: EvaluationStatus;
  components: EvaluationComponentStatus[];
  submitted_components: number;
  total_components: number;
  total_score?: number;
  max_score?: number;
  submitted_at?: string;
  feedback?: string;
}

/**
 * Student evaluation summary
 */
export interface StudentEvaluation {
  student_id: number;
  student_name: string;
  nim: string;
  evaluations: SupervisorEvaluation[];
  overall_status: EvaluationStatus;
  overall_score?: number;
}

/**
 * Evaluation type configuration
 * Used in admin assessment configuration
 */
export interface EvaluationTypeConfig {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  component_count: number;
  required: boolean;
}

/**
 * Grade configuration
 */
export interface GradeConfig {
  min_score: number;
  max_score: number;
  letter_grade: string;
  description?: string;
}

/**
 * Peer review evaluation
 */
export interface PeerReviewEvaluation {
  id: number;
  reviewer_id: number;
  reviewer_name: string;
  reviewee_id: number;
  reviewee_name: string;
  indicator_count: number;
  completed_indicators: number;
  status: EvaluationStatus;
  submitted_at?: string;
}

/**
 * Milestone evaluation
 */
export interface MilestoneEvaluation {
  id: number;
  name: string;
  required: boolean;
  configured: boolean;
  completed: boolean;
  component_count: number;
  supervisors: SupervisorInEvaluation[];
}

/**
 * Expo evaluation
 */
export interface ExpoEvaluation {
  id: number;
  name: string;
  required: boolean;
  configured: boolean;
  completed: boolean;
  component_count: number;
  supervisors: SupervisorInEvaluation[];
}

/**
 * Nilai dosen (lecturer grades) evaluation
 */
export interface NilaiDosenEvaluation {
  id: number;
  name: string;
  required: boolean;
  configured: boolean;
  completed: boolean;
  component_count: number;
  supervisors: SupervisorInEvaluation[];
}

/**
 * Final evaluation status
 */
export interface FinalEvaluationStatus {
  ready: boolean;
  expo_documents: {
    completed: boolean;
    pending_types: string[];
    total_required: number;
    approved_count: number;
  };
  nilai_dosen: NilaiDosenEvaluation;
  milestone: MilestoneEvaluation;
  expo_evaluation: ExpoEvaluation;
  peer_review: {
    required: boolean;
    configured: boolean;
    completed: boolean;
    indicator_count: number;
    total_members: number;
    completed_members: number;
  };
}
