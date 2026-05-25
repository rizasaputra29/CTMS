/**
 * Schedule Type Definitions
 * Schedule events, calendars, and booking types
 */

import type { User } from './user';

/**
 * Schedule event types
 */
export type ScheduleEventType =
  | 'SEMPRO'
  | 'SIDANG'
  | 'EXPO'
  | 'BIMBINGAN'
  | 'TA_DEFENSE'
  | 'PDC1'
  | 'PDC2';

/**
 * Schedule status types
 */
export type ScheduleStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'draft';

/**
 * Schedule mode types
 * Used for online/offline schedule distinction
 */
export type ScheduleMode = 'offline' | 'online';

/**
 * Schedule type filter for filtering by event type
 */
export type ScheduleTypeFilter = 'all' | ScheduleEventType;

/**
 * Schedule status filter for filtering by status
 */
export type ScheduleStatusFilter = 'all' | ScheduleStatus;

/**
 * Main schedule event interface
 * Used in calendar and table views
 */
export interface ScheduleEvent {
  id: number | string;
  group_id: number;
  student_id?: number;
  type: ScheduleEventType;
  date: string;
  room: string;
  mode?: ScheduleMode | null;
  notes?: string | null;
  status?: ScheduleStatus;
  period_name?: string;
  student_name?: string;
  examiner1?: { name: string } | null;
  examiner2?: { name: string } | null;
  examiners?: { name: string; role?: string }[];
  start_time?: string;
  end_time?: string;
  online_link?: string;
  rejection_reason?: string;
  group: {
    title: { title: string; lecturer?: { name: string } | null } | null;
    members?: { student: { name: string } }[];
    supervisor?: { name: string } | null;
  };
}

/**
 * API Schedule response
 */
export interface ApiSchedule {
  id: number;
  group_id: number;
  type: ScheduleEventType;
  date: string;
  start_time?: string;
  end_time?: string;
  room: string;
  mode?: ScheduleMode;
  status: ScheduleStatus;
  notes?: string;
  online_link?: string;
  examiners?: Array<{
    id: number;
    name: string;
    role?: string;
  }>;
  group?: {
    id: number;
    name: string;
    title?: {
      title: string;
    } | null;
    supervisor1?: User | null;
    supervisor2?: User | null;
  };
}

/**
 * Schedule filters
 */
export interface ScheduleFilters {
  period_id?: number;
  type?: ScheduleEventType;
  status?: ScheduleStatus;
  start_date?: string;
  end_date?: string;
  group_id?: number;
  student_id?: number;
}

/**
 * Schedule booking request
 */
export interface ScheduleBookingRequest {
  group_id: number;
  type: ScheduleEventType;
  date: string;
  start_time?: string;
  end_time?: string;
  room: string;
  mode?: ScheduleMode;
  notes?: string;
  online_link?: string;
  examiners?: number[];
}

/**
 * Schedule approval request
 */
export interface ScheduleApprovalRequest {
  status: 'approved' | 'rejected';
  rejection_reason?: string;
}

/**
 * Upcoming schedule item
 * Used in dashboard
 */
export interface UpcomingSchedule {
  id: number;
  type: ScheduleEventType;
  date: string;
  start_time?: string;
  end_time?: string;
  room: string;
  status: ScheduleStatus;
  group_id: number;
  group_name?: string;
  title?: string;
}

/**
 * Seminar schedule with evaluations
 * Used in mahasiswa dashboard
 */
export interface SeminarSchedule {
  exists: boolean;
  date?: string;
  room?: string;
  start_time?: string;
  end_time?: string;
  examiners?: Array<{ id: number; name: string }>;
  status?: ScheduleStatus;
  examiner_evaluations?: {
    required: boolean;
    configured: boolean;
    completed: boolean;
  };
  supervisor_bimbingan?: {
    supervisors: Array<{
      id: number;
      name: string;
      status: string;
      submitted_components: number;
      total_components: number;
    }>;
  };
  is_ready_for_pdc2?: boolean;
  message?: string;
}

/**
 * Schedule update/edit request payload
 * Used when updating existing sempro/sidang schedules
 */
export interface ScheduleUpdatePayload {
  date: string;
  start_time: string;
  end_time: string;
  examiner_1_id: number;
  examiner_2_id: number;
  location_id: number | null;
  room?: string;
}
