/**
 * API Response Type Definitions
 * Generic types for API responses and Axios handling
 */

import type { AxiosResponse, AxiosError } from 'axios';

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
 * Extended API error with response data
 * Used when API returns error with specific data structure
 */
export interface ApiErrorWithResponse extends ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
      conflicts?: string[];
    };
    status?: number;
  };
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

/**
 * Type guard: Check if value is a valid ApiResponse
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value
  );
}

/**
 * Type guard: Check if value is ApiErrorWithResponse
 */
export function isApiErrorWithResponse(error: unknown): error is ApiErrorWithResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as ApiErrorWithResponse).response === 'object'
  );
}

/**
 * Extract error message from API error
 * Safe way to get error message without type assertions
 */
export function getApiErrorMessage(error: unknown): string {
  if (isApiErrorWithResponse(error)) {
    return error.response?.data?.message || 
           error.response?.data?.error || 
           error.message || 
           'An error occurred';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
}

/**
 * Type guard: Check if error is AxiosError
 */
export function isAxiosError<T>(error: unknown): error is AxiosError<T> {
  return error instanceof Error && 'isAxiosError' in error && (error as AxiosError).isAxiosError === true;
}
