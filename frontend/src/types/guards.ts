/**
 * Type Guard Utilities
 * Helper functions for type-safe runtime checks and narrowing
 */

import type { ScheduleMode } from './schedule';

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
