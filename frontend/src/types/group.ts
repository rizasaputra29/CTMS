/**
 * Group Type Definitions
 * Groups, members, and group-related types
 */

import type { User, Student } from './user';
import type { Period } from './period';
import type { Title } from './title';

/**
 * Group status from backend
 */
export type GroupStatus =
  | 'FORMING'
  | 'FORMING_SOLO'
  | 'READY_FOR_BIDDING'
  | 'TITLE_PROPOSED'
  | 'TITLE_APPROVED'
  | 'READY_FOR_FINALIZATION'
  | 'KELOMPOK_FINAL'
  | 'PDC1_ACTIVE'
  | 'READY_FOR_SEMPRO'
  | 'SEMPRO_DONE'
  | 'PDC2_ACTIVE'
  | 'TA_DRAFT'
  | 'PDC2_READY_FOR_EXPO'
  | 'EXPO_REGISTERED'
  | 'EXPO_DONE'
  | 'READY_FOR_TA_INDIVIDUAL'
  | 'TA_IN_PROGRESS'
  | 'CLOSED'
  | 'DISSOLVED';

/**
 * Group status category for UI
 */
export type GroupStatusCategory =
  | 'NO_GROUP'
  | 'HAS_GROUP_NO_TITLE'
  | 'NOT_READY'
  | 'READY_FOR_FINALIZATION'
  | 'KELOMPOK_FINAL'
  | 'PDC1_ACTIVE'
  | 'PDC2_ACTIVE'
  | 'CLOSED'
  | 'DISSOLVED';

/**
 * Group member role
 */
export type GroupMemberRole = 'leader' | 'member' | string;

/**
 * Group member interface
 */
export interface GroupMember {
  id: number;
  student_id: number;
  student: Student;
  role?: GroupMemberRole;
  joined_at?: string;
  is_leader?: boolean;
}

/**
 * Main Group interface
 */
export interface Group {
  id: number;
  name: string;
  status: GroupStatus;
  period_id: number;
  period?: Period;
  title_id?: number;
  title?: Title;
  members: GroupMember[];
  supervisor_1_id?: number;
  supervisor_2_id?: number;
  supervisor1?: User;
  supervisor2?: User;
  finalization_notes?: string;
  finalized_at?: string;
  finalized_by?: number;
  created_at: string;
  updated_at: string;
  status_label?: string;
  member_count?: number;
  allowed_actions?: {
    can_set_supervisor?: boolean;
    can_mark_kelompok_final?: boolean;
    can_cancel_kelompok_final?: boolean;
    can_assign_title?: boolean;
    can_promote_to_ready_for_finalization?: boolean;
    reason?: string | null;
  };
}

/**
 * Group summary for lists
 */
export interface GroupSummary {
  id: number;
  name: string;
  status: GroupStatus;
  member_count: number;
  supervisor1_name?: string;
  supervisor2_name?: string;
  title?: string;
}

/**
 * Group with progress information
 * Used in analytics/progress page
 */
export interface GroupProgress {
  id: number;
  name: string | null;
  status: GroupStatus;
  period_id: number;
  period: Period;
  title: {
    id: number;
    title: string;
  } | null;
  supervisor1: {
    id: number;
    name: string;
  } | null;
  supervisor2: {
    id: number;
    name: string;
  } | null;
  members: GroupMember[];
  members_count: number;
  progress: {
    phases: ProgressPhase[];
    current_phase: string | null;
    is_graduated: boolean;
  } | null;
  progress_percentage: number;
}

/**
 * Progress phase
 */
export interface ProgressPhase {
  phase: string;
  status: 'locked' | 'unlocked' | 'draft' | 'submitted' | 'revision' | 'completed';
  documents: Array<{
    type: string;
    status: string;
  }>;
}

/**
 * Group creation request
 */
export interface CreateGroupRequest {
  name: string;
  period_id: number;
  member_ids: number[];
  supervisor_1_id?: number;
  supervisor_2_id?: number;
}

/**
 * Group with minimal info
 * Used in dropdowns and selectors
 */
export interface GroupMinimal {
  id: number;
  name: string;
  status: GroupStatus;
  members_count: number;
}
