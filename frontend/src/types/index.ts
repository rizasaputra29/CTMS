/**
 * Type Definitions Barrel Export
 * Central export point for all type definitions
 *
 * Usage:
 *   import { User, Group, ScheduleEvent } from '@/types';
 */

// ==========================================
// API & Base Types
// ==========================================
export * from './api';

// ==========================================
// Domain Types
// ==========================================
export * from './auth';
export * from './user';
export * from './group';
export * from './period';
export * from './title';
export * from './bid';
export * from './schedule';
export * from './document';
export * from './evaluation';
export * from './notification';
export * from './workflow';

// ==========================================
// Dashboard Types
// ==========================================
export * from './dashboard';

// ==========================================
// Component Prop Types
// ==========================================
export * from './components';

// ==========================================
// Re-exports from finalization.ts (legacy)
// ==========================================
export type {
  BackendGroupStatus,
  GroupStatusCategory,
  GroupStatus,
  DashboardTab,
  OthersSubTab,
  User as FinalizationUser,
  Student as FinalizationStudent,
  Period as FinalizationPeriod,
  Title as FinalizationTitle,
  GroupMember as FinalizationGroupMember,
  Group as FinalizationGroup,
  FinalizationFlow,
  LecturerWithLoad as FinalizationLecturerWithLoad,
  PaginationMeta,
  PaginatedResponse,
  DocumentRequirementsStatus,
  DashboardStats as FinalizationDashboardStats,
  DashboardResponse as FinalizationDashboardResponse,
  LecturersResponse,
  BatchSupervisorRequest,
  BatchSupervisorResult,
  ExecuteFinalizationRequest,
  RollbackFinalizationRequest,
  CancelKelompokFinalRequest,
  ExportRequest,
  SupervisorLoad,
  FinalizationNotificationType,
  SelectionState,
  FilterState as FinalizationFilterState,
} from './finalization';
