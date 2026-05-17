import { useParams } from 'next/navigation';
import { useMemo } from 'react';

/**
 * Utility to validate and extract a string param
 */
export function getStringParam(
  value: string | string[] | undefined
): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return null;
}

/**
 * Utility to validate and extract a number param
 */
export function getNumberParam(
  value: string | string[] | undefined
): number | null {
  const str = getStringParam(value);
  if (str === null) return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * Utility to validate and extract a non-empty string param
 * Returns null if empty or whitespace only
 */
export function getNonEmptyStringParam(
  value: string | string[] | undefined
): string | null {
  const str = getStringParam(value);
  if (str === null) return null;
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Hook to get validated URL params
 * Usage: const { studentId } = useValidatedParams({ studentId: 'string' })
 */
export function useValidatedParams<T extends Record<string, 'string' | 'number'>>(
  schema: T
): { [K in keyof T]: T[K] extends 'number' ? number | null : string | null } {
  const params = useParams();

  return useMemo(() => {
    const result: Record<string, string | number | null> = {};

    for (const [key, type] of Object.entries(schema)) {
      const value = params[key];
      if (type === 'number') {
        result[key] = getNumberParam(value);
      } else {
        result[key] = getStringParam(value);
      }
    }

    return result as { [K in keyof T]: T[K] extends 'number' ? number | null : string | null };
  }, [params, schema]);
}

/**
 * Get a validated string param from useParams
 */
export function useStringParam(paramName: string): string | null {
  const params = useParams();
  return useMemo(() => {
    return getStringParam(params[paramName]);
  }, [params, paramName]);
}

/**
 * Get a validated number param from useParams
 */
export function useNumberParam(paramName: string): number | null {
  const params = useParams();
  return useMemo(() => {
    return getNumberParam(params[paramName]);
  }, [params, paramName]);
}