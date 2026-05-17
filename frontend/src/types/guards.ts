/**
 * Type Guard Utilities
 * Helper functions for type-safe runtime checks and narrowing
 */

import type { ScheduleMode } from './schedule';

// Re-export type guards from finalization.ts for convenience
export {
  isDashboardTab,
  isOthersSubTab,
  isSupervisorStatus,
  isMemberCount,
  isTitleStatus,
} from './finalization';

/**
 * Validates and narrows a string to ScheduleMode
 */
export function isScheduleMode(value: string): value is ScheduleMode {
  return value === 'offline' || value === 'online';
}

/**
 * Validates and returns ScheduleMode or default value
 */
export function toScheduleMode(value: string | null | undefined, defaultValue: ScheduleMode = 'offline'): ScheduleMode {
  if (value && isScheduleMode(value)) {
    return value;
  }
  return defaultValue;
}

/**
 * Validates if value is a valid number string and converts it
 */
export function toNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validates if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validates if value is a valid array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Validates if value is an object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Validates if value is a valid date string
 */
export function isValidDateString(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validates if value is a valid ID (positive number or numeric string)
 */
export function isValidId(value: string | number | null | undefined): value is string | number {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }
  return false;
}

/**
 * Converts URL param to validated string
 */
export function toValidString(param: string | string[] | undefined): string | null {
  if (typeof param === 'string' && param.length > 0) {
    return param;
  }
  if (Array.isArray(param) && param.length > 0) {
    return param[0];
  }
  return null;
}

// ============================================================================
// Role Tab Type Guards
// ============================================================================

export type RoleTab = 'all' | 'mahasiswa' | 'dosen' | 'admin';

/**
 * Validates if value is a valid RoleTab
 */
export function isRoleTab(value: string): value is RoleTab {
  return ['all', 'mahasiswa', 'dosen', 'admin'].includes(value);
}

/**
 * Converts value to RoleTab or returns default
 */
export function toRoleTab(value: string | null | undefined, defaultValue: RoleTab = 'all'): RoleTab {
  if (value && isRoleTab(value)) {
    return value;
  }
  return defaultValue;
}

// ============================================================================
// View Mode Type Guards
// ============================================================================

export type ViewMode = 'schedule' | 'group';

/**
 * Validates if value is a valid ViewMode
 */
export function isViewMode(value: string): value is ViewMode {
  return value === 'schedule' || value === 'group';
}

/**
 * Converts value to ViewMode or returns default
 */
export function toViewMode(value: string | null | undefined, defaultValue: ViewMode = 'schedule'): ViewMode {
  if (value && isViewMode(value)) {
    return value;
  }
  return defaultValue;
}

// ============================================================================
// Navigation Key Type Guards
// ============================================================================

export type NavRoleKey = 'admin' | 'mahasiswa' | 'dosen';

/**
 * Validates if value is a valid navigation role key
 */
export function isNavRoleKey(value: string): value is NavRoleKey {
  return ['admin', 'mahasiswa', 'dosen'].includes(value);
}

/**
 * Gets navigation items key with type safety
 * Returns the key if valid, otherwise returns 'mahasiswa' as safe default
 */
export function toNavRoleKey(value: string | null | undefined): NavRoleKey {
  if (value && isNavRoleKey(value)) {
    return value;
  }
  return 'mahasiswa';
}

// ============================================================================
// Evaluation Type Key Guards
// ============================================================================

export type EvaluationTypeKey = 'SEMPRO' | 'BIMBINGAN_SEMPRO' | 'SIDANG_TA' | 'BIMBINGAN_TA' | 'EXPO' | 'MILESTONE' | 'NILAI_DOSEN';

/**
 * Validates if value is a valid evaluation type key
 */
export function isEvaluationTypeKey(value: string): value is EvaluationTypeKey {
  return [
    'SEMPRO',
    'BIMBINGAN_SEMPRO',
    'SIDANG_TA',
    'BIMBINGAN_TA',
    'EXPO',
    'MILESTONE',
    'NILAI_DOSEN'
  ].includes(value);
}

// ============================================================================
// Object Key Access Helpers
// ============================================================================

/**
 * Type-safe object property access with validation
 * Returns the value if key exists, undefined otherwise
 */
export function getObjectProperty<T extends Record<string, unknown>>(
  obj: T,
  key: string
): T[keyof T] | undefined {
  if (key in obj) {
    return obj[key as keyof T];
  }
  return undefined;
}

/**
 * Type-safe record access with fallback
 * Returns the value if key exists, otherwise returns the fallback
 */
export function getRecordValue<T>(
  record: Record<string, T>,
  key: string,
  fallback: T
): T {
  return record[key] ?? fallback;
}

/**
 * Evaluation status data interface
 */
export interface EvaluationStatusData {
  score: number | null;
  status: 'COMPLETE' | 'PARTIAL' | 'NOT_STARTED';
  total_components: number;
  scored_components: number;
}

/**
 * Type-safe access to evaluation data from evaluations record
 * Uses proper type guards instead of unsafe 'as keyof' assertions
 */
export function getEvaluationData<T extends Record<string, EvaluationStatusData>>(
  evaluations: T,
  key: string
): EvaluationStatusData | undefined {
  if (key in evaluations) {
    return evaluations[key as keyof T];
  }
  return undefined;
}

/**
 * FinalReadyStatus evaluation section (for mahasiswa dashboard)
 * Represents the common structure of evaluation sections in FinalReadyStatus
 */
export interface FinalReadyEvaluationSection {
  required?: boolean;
  configured: boolean;
  completed: boolean;
  component_count?: number;
  supervisors?: unknown[];
}

/**
 * Type guard to check if a value is a FinalReadyEvaluationSection
 */
export function isFinalReadyEvaluationSection(value: unknown): value is FinalReadyEvaluationSection {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'configured' in obj && typeof obj.configured === 'boolean';
}

/**
 * Type for student evaluations record
 */
export type StudentEvaluationsRecord = {
  SEMPRO: EvaluationStatusData;
  BIMBINGAN_SEMPRO: EvaluationStatusData;
  SIDANG_TA: EvaluationStatusData;
  BIMBINGAN_TA: EvaluationStatusData;
  EXPO: EvaluationStatusData;
  MILESTONE: EvaluationStatusData;
  NILAI_DOSEN: EvaluationStatusData;
};
