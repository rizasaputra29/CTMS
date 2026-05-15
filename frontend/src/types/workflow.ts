/**
 * Workflow Type Definitions
 * Workflow phases, requirements, and state management
 */

import type { LatestDocument } from './document';
import type { SupervisorInEvaluation } from './user';
import type { WorkflowPhase } from './dashboard';

/**
 * Workflow step keys
 */
export type WorkflowStepKey =
  | 'BIDDING'
  | 'APPROVAL'
  | 'PDC1'
  | 'SEMPRO'
  | 'PDC2'
  | 'EXPO'
  | 'SIDANG';

/**
 * Workflow step
 */
export interface WorkflowStep {
  key: WorkflowStepKey;
  label: string;
  description?: string;
  order: number;
}

/**
 * Phase document requirement in workflow context
 */
export interface WorkflowPhaseDocumentRequirement {
  type: string;
  name: string;
  required: boolean;
  status: 'missing' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  latest_document?: LatestDocument | null;
}

/**
 * Phase evaluation requirement
 */
export interface PhaseEvaluationRequirement {
  type: string;
  name: string;
  required: boolean;
  configured: boolean;
  completed: boolean;
  component_count: number;
  supervisors: SupervisorInEvaluation[];
}

/**
 * Phase requirement status
 */
export interface PhaseRequirementStatus {
  phase: string;
  documents: {
    completed: boolean;
    total_required: number;
    approved_count: number;
    pending_types: string[];
  };
  evaluations?: PhaseEvaluationRequirement[];
  is_ready: boolean;
  blockers: string[];
}

/**
 * Workflow state
 */
export interface WorkflowState {
  current_phase: string | null;
  phases: WorkflowPhase[];
  is_graduated: boolean;
  can_advance: boolean;
  requirements: PhaseRequirementStatus[];
}

/**
 * Workflow phase detail
 */
export interface WorkflowPhaseDetail {
  phase: string;
  status: 'locked' | 'unlocked' | 'submitted' | 'draft' | 'revision' | 'completed';
  documents: WorkflowPhaseDocumentRequirement[];
  required_types: string[];
  document_count: number;
}

/**
 * Workflow requirement check
 */
export interface WorkflowRequirementCheck {
  type: 'document' | 'evaluation' | 'schedule';
  name: string;
  required: boolean;
  completed: boolean;
  message?: string;
}

/**
 * Workflow progress
 */
export interface WorkflowProgress {
  total_phases: number;
  completed_phases: number;
  current_phase: string | null;
  percentage: number;
}

/**
 * Phase transition request
 */
export interface PhaseTransitionRequest {
  current_phase: string;
  next_phase: string;
  confirmation?: boolean;
}

/**
 * Phase transition response
 */
export interface PhaseTransitionResponse {
  success: boolean;
  message: string;
  new_phase?: string;
  blockers?: string[];
}

/**
 * Supervisor bimbingan status
 */
export interface SupervisorBimbinganStatus {
  supervisors: SupervisorInEvaluation[];
  is_ready: boolean;
  total_completed: number;
  total_supervisors: number;
}
