import type { Period } from '@/types/period';

/**
 * Check if value is a valid Period object
 */
export function isPeriod(value: unknown): value is Period {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'number' &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

/**
 * Check if value is an array of Period objects
 */
export function isPeriodArray(value: unknown): value is Period[] {
  return Array.isArray(value) && value.every(isPeriod);
}

/**
 * Normalizes various API response structures to Period[]
 * Handles: Period[], { data: Period[] }, { data: { data: Period[] } }
 */
export function normalizePeriodList(payload: unknown): Period[] {
  // Direct array
  if (isPeriodArray(payload)) return payload;
  
  // Object with data property
  if (payload && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data;
    
    // data is Period[]
    if (isPeriodArray(data)) return data;
    
    // data is object with nested data
    if (data && typeof data === 'object') {
      const nested = (data as Record<string, unknown>).data;
      if (isPeriodArray(nested)) return nested;
    }
  }
  
  return [];
}

/**
 * Normalizes various API response structures to Period | null
 * Handles: Period, { data: Period }, etc.
 */
export function normalizePeriodDetail(payload: unknown): Period | null {
  if (!payload || typeof payload !== 'object') return null;
  
  // Direct Period object
  if (isPeriod(payload)) return payload;
  
  // Object with data property
  const data = (payload as Record<string, unknown>).data;
  if (isPeriod(data)) return data;
  
  return null;
}