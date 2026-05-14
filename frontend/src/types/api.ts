/**
 * API Response Type Definitions
 * Generic types for API responses and Axios handling
 */

import type { AxiosResponse } from 'axios';

/**
 * Generic API response wrapper
 * Used when API returns { data: T, message?: string }
 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  status?: string;
}

/**
 * Generic API error response
 */
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
}

/**
 * API list response (for endpoints returning arrays)
 */
export interface ApiListResponse<T> {
  data: T[];
  message?: string;
}

/**
 * Promise settled result helper type
 * Used with Promise.allSettled to extract data from fulfilled promises
 */
export type SettledResultData<T> =
  | { status: 'fulfilled'; value: AxiosResponse<T> }
  | { status: 'rejected'; reason: unknown };

/**
 * Extract data from settled promise result
 * Returns null if rejected
 */
export function getSettledData<T>(
  result: SettledResultData<T>
): T | null {
  return result.status === 'fulfilled' ? result.value.data : null;
}
