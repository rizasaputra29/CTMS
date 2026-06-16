import type { AxiosError } from 'axios';
import type { ApiErrorWithResponse } from '@/types/api';

/**
 * Check if error is an API error with response data
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
 */
export function getApiErrorMessage(error: unknown): string {
  if (isApiErrorWithResponse(error)) {
    return error.response?.data?.message || 
           error.response?.data?.error || 
           (error as Error).message || 
           'An error occurred';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred';
}

/**
 * Check if error is an Axios error with typed response data
 */
export function isAxiosError<T extends { message?: string; error?: string } = { message?: string; error?: string }>(
  error: unknown
): error is AxiosError<T> {
  return error instanceof Error && 'isAxiosError' in error;
}