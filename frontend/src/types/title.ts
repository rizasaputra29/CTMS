/**
 * Title Type Definitions
 * Title management, history, and bidding types
 */

import type { User, Lecturer } from './user';
import type { Period } from './period';

/**
 * Title status types
 */
export type TitleStatus =
  | 'open'
  | 'closed'
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'WITHDRAWN';

/**
 * Title source types
 */
export type TitleSource = 'STUDENT' | 'LECTURER';

/**
 * Main Title interface
 */
export interface Title {
  id: number;
  title: string;
  description: string;
  problem_statement?: string | null;
  scope?: string | null;
  specializations?: string[] | null;
  quota: number;
  status: TitleStatus;
  active_groups_count: number;
  lecturer_id: number;
  lecturer?: Lecturer;
  pre_assigned_group_id?: number | null;
  title_source?: TitleSource;
  period_id?: number;
  period?: Period;
  created_at?: string;
  updated_at?: string;
}

/**
 * Title approval history item
 * Used in title history dialogs
 */
export interface TitleApprovalHistoryItem {
  id: number;
  title_id: number;
  previous_status: TitleStatus;
  new_status: TitleStatus;
  action?: string;
  reason?: string | null;
  approved_by?: number;
  approved_by_user?: User;
  lecturer?: User;
  affected_group?: {
    id: number;
    name: string;
  };
  created_at: string;
}

/**
 * Title deletion history item
 * Used in title history dialogs
 */
export interface TitleDeletionHistoryItem {
  id: number;
  title_id: number;
  deleted_by: number;
  deleted_by_user?: User;
  action?: string;
  lecturer?: User;
  affected_groups_count?: number;
  reverted_group_ids?: number[];
  reason?: string | null;
  created_at: string;
}

/**
 * Title form data for creating/editing
 */
export interface TitleFormData {
  title: string;
  description: string;
  problem_statement?: string;
  scope?: string;
  specializations: string[];
  quota: number;
  pre_assigned_group_id?: string | number;
  period_id?: number;
}

/**
 * Title with related groups
 */
export interface TitleWithGroups extends Title {
  groups?: Array<{
    id: number;
    name: string;
    status: string;
    members_count: number;
  }>;
}

/**
 * Title summary for lists
 */
export interface TitleSummary {
  id: number;
  title: string;
  status: TitleStatus;
  lecturer_name?: string;
  quota: number;
  active_groups_count: number;
}

/**
 * Title marketplace item
 * Used in bidding/marketplace views
 */
export interface TitleMarketplaceItem {
  id: number;
  title: string;
  description: string;
  quota: number;
  status: TitleStatus;
  lecturer?: {
    id: number;
    name: string;
    expertise?: string[];
  };
  available_quota: number;
  is_available: boolean;
}
