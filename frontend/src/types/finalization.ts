/**
 * Finalization System Types
 * Types for the admin finalization dashboard
 */

// Backend Group status types (actual statuses from database)
export type BackendGroupStatus =
  | 'FORMING'
  | 'FORMING_SOLO'
  | 'READY_FOR_BIDDING'
  | 'TITLE_PROPOSED'
  | 'TITLE_APPROVED'
  | 'READY_FOR_FINALIZATION'
  | 'KELOMPOK_FINAL'
  | 'PDC1_ACTIVE'
  | 'PDC2_ACTIVE'
  | 'CLOSED'
  | 'DISSOLVED';

// UI Category types for grouping groups in tabs
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

// For backward compatibility, alias GroupStatus to the backend type
export type GroupStatus = BackendGroupStatus;

// Tab types for dashboard
export type DashboardTab = 'ready' | 'final' | 'others';
export type OthersSubTab = 'no_group' | 'no_title' | 'not_ready';

/**
 * Validates if value is a valid DashboardTab
 */
export function isDashboardTab(value: string): value is DashboardTab {
  return ['ready', 'final', 'others'].includes(value);
}

/**
 * Validates if value is a valid OthersSubTab
 */
export function isOthersSubTab(value: string): value is OthersSubTab {
  return ['no_group', 'no_title', 'not_ready'].includes(value);
}

// Base user type
export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  nim?: string;
  nip?: string;
  is_active?: boolean;
}

// Student type
export interface Student extends User {
  nim: string;
}

// Period type
export interface Period {
  id: number;
  name: string;
  is_active: boolean;
  is_finalized?: boolean;
  max_supervisor_load?: number;
  min_group_size?: number;
  max_group_size?: number;
  start_date?: string;
  end_date?: string;
}

// Title type
export interface Title {
  id: number;
  title: string;
  description?: string;
  status: string;
  lecturer?: User;
  quota?: number;
  title_source?: 'STUDENT' | 'LECTURER';
}

// Group member type
export interface GroupMember {
  id: number;
  student_id: number;
  student: Student;
  role?: string;
  joined_at?: string;
}

// Group type with supervisors
export interface Group {
  id: number;
  code?: string;
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
 * Type guard to check if a value is a Group
 */
export function isGroup(value: unknown): value is Group {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'number' &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    'members' in value &&
    Array.isArray((value as Record<string, unknown>).members)
  );
}

/**
 * Type guard to check if an array is Group[]
 */
export function isGroupArray(value: unknown[]): value is Group[] {
  return value.length === 0 || isGroup(value[0]);
}

/**
 * Type guard to check if a value is a Student
 */
export function isStudent(value: unknown): value is Student {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'number' &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    'nim' in value &&
    typeof (value as Record<string, unknown>).nim === 'string'
  );
}

/**
 * Type guard to check if an array is Student[]
 */
export function isStudentArray(value: unknown[]): value is Student[] {
  return value.length === 0 || isStudent(value[0]);
}

export interface FinalizationBlocker {
  type: string;
  message: string;
  severity: 'error' | 'warning';
  action?: string;
}

export interface PrerequisiteItem {
  type: string;
  label: string;
  configured: boolean;
  severity: 'success' | 'error' | 'warning';
  message: string;
  configure_url: string;
  edit_url: string;
}

export interface FinalizationFlow {
  can_modify: boolean;
  can_execute_finalization: boolean;
  reason: string | null;
  tab?: DashboardTab;
  sub_tab?: OthersSubTab;
  blockers: FinalizationBlocker[];
  prerequisites?: PrerequisiteItem[];
}

// Lecturer with load information
export interface LecturerWithLoad extends User {
  current_load: number;
  max_load: number;
  remaining_capacity: number;
  is_overloaded: boolean;
}

// Pagination meta
export interface PaginationMeta {
  current_page: number;
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: Array<{
    url: string | null;
    label: string;
    active: boolean;
  }>;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

// Document requirements status
export interface DocumentRequirementsStatus {
  phases: Record<string, {
    configured: boolean;
    count: number;
    required_count: number;
  }>;
  all_configured: boolean;
  configured_phases: number;
  total_phases: number;
  total_requirements: number;
}

// Dashboard stats
export interface DashboardStats {
  total_ready: number;
  total_kelompok_final: number;
  total_pdc1_active?: number;
  total_no_group: number;
  total_no_title: number;
  total_not_ready: number;
  can_finalize: boolean;
  can_reopen_finalization?: boolean;
  document_requirements?: DocumentRequirementsStatus;
  // Post-finalization groups
  total_post_finalization?: number;
  post_finalization_breakdown?: Record<string, number>;
}

// Dashboard response
export interface DashboardResponse {
  period: Period;
  tab: DashboardTab;
  stats: DashboardStats;
  data: PaginatedResponse<Group> | PaginatedResponse<Student> | PaginatedResponse<Group>;
  flow?: FinalizationFlow;
}

// Lecturers response
export interface LecturersResponse {
  period: Period;
  lecturers: LecturerWithLoad[];
}

// Batch supervisor assignment request
export interface BatchSupervisorRequest {
  group_ids: number[];
  supervisor_1_id: number;
  supervisor_2_id?: number;
  notes?: string;
}

// Batch supervisor assignment result
export interface BatchSupervisorResult {
  success: Array<{
    group_id: number;
    name: string;
  }>;
  failed: Array<{
    group_id: number;
    reason: string;
  }>;
}

// Execute finalization request
export interface ExecuteFinalizationRequest {
  period_id: number;
  confirmation: boolean;
}

// Rollback finalization request
export interface RollbackFinalizationRequest {
  period_id: number;
  group_ids?: number[];
  reason: string;
}

// Cancel Kelompok Final request
export interface CancelKelompokFinalRequest {
  period_id: number;
  group_id: number;
  reason?: string;
}

// Export request
export interface ExportRequest {
  period_id: number;
  format: 'excel' | 'pdf';
}

// Supervisor load info
export interface SupervisorLoad {
  current_load: number;
  max_load: number;
  remaining_capacity: number;
  is_overloaded: boolean;
}

// Notification types for finalization
export type FinalizationNotificationType =
  | 'SUPERVISOR_ASSIGNED'
  | 'FINALIZATION_EXECUTED'
  | 'FINALIZATION_ROLLBACK'
  | 'FINALIZATION_COMPLETED';

// Table row selection state
export interface SelectionState {
  selectedIds: number[];
  selectAll: boolean;
}

// Filter state
export interface FilterState {
  search: string;
  perPage: number;
  page: number;
  // Advanced filters
  supervisorStatus?: 'all' | 'missing_sv1' | 'missing_sv2' | 'complete';
  memberCount?: 'all' | 'under_min' | 'in_range' | 'over_max';
  titleStatus?: 'all' | 'no_title' | 'lecturer_title' | 'marketplace_title';
}

// Filter panel state (subset of FilterState used by FilterPanel component)
export interface FilterPanelState {
  supervisorStatus: 'all' | 'missing_sv1' | 'missing_sv2' | 'complete';
  memberCount: 'all' | 'under_min' | 'in_range' | 'over_max';
  titleStatus?: 'all' | 'no_title' | 'lecturer_title' | 'marketplace_title';
}

// Type guard for supervisor status
export function isSupervisorStatus(value: string): value is FilterPanelState['supervisorStatus'] {
  return ['all', 'missing_sv1', 'missing_sv2', 'complete'].includes(value);
}

// Type guard for member count
export function isMemberCount(value: string): value is FilterPanelState['memberCount'] {
  return ['all', 'under_min', 'in_range', 'over_max'].includes(value);
}

// Type guard for title status
export type TitleStatus = 'all' | 'no_title' | 'lecturer_title' | 'marketplace_title';
export function isTitleStatus(value: string): value is TitleStatus {
  return ['all', 'no_title', 'lecturer_title', 'marketplace_title'].includes(value);
}
