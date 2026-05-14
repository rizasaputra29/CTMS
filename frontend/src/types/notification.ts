/**
 * Notification Type Definitions
 * Notifications, alerts, and messaging types
 */

import type { User } from './user';

/**
 * Notification types
 */
export type NotificationType =
  | 'title_approved'
  | 'title_rejected'
  | 'group_invitation'
  | 'bid_accepted'
  | 'bid_rejected'
  | 'schedule_created'
  | 'schedule_updated'
  | 'document_approved'
  | 'document_rejected'
  | 'evaluation_completed'
  | 'phase_changed'
  | 'system'
  | 'SUPERVISOR_ASSIGNED'
  | 'FINALIZATION_EXECUTED'
  | 'FINALIZATION_ROLLBACK'
  | 'FINALIZATION_COMPLETED';

/**
 * Notification priority
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Notification status
 */
export type NotificationStatus = 'unread' | 'read' | 'archived';

/**
 * Main notification interface
 */
export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority: NotificationPriority;
  status: NotificationStatus;
  action_url?: string;
  action_text?: string;
  created_at: string;
  read_at?: string;
  sender?: User;
}

/**
 * Notification summary
 */
export interface NotificationSummary {
  total_unread: number;
  recent: Notification[];
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  types: Record<NotificationType, boolean>;
}

/**
 * Create notification request
 */
export interface CreateNotificationRequest {
  user_ids: number[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  action_url?: string;
  action_text?: string;
}

/**
 * Mark notification request
 */
export interface MarkNotificationRequest {
  ids: number[];
  status: NotificationStatus;
}

/**
 * Toast notification type
 * Used with sonner/toast library
 */
export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
