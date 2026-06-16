/**
 * Generic hook for search, filter, and sort operations.
 * Works with any array of objects and is fully typed.
 */

import { useState, useMemo, useCallback } from 'react';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseSearchFilterSortOptions<T> {
  /** Initial data array */
  data: T[];
  /** Fields to search against (supports dot notation for nested fields, e.g. 'lecturer.name') */
  searchFields: string[];
  /** Custom filter function. Return true to keep the item. */
  filterFn?: (item: T, filters: Record<string, unknown>) => boolean;
  /** Initial sort configuration */
  initialSort?: SortConfig;
  /** Initial filters */
  initialFilters?: Record<string, unknown>;
}

export interface UseSearchFilterSortResult<T> {
  /** Filtered and sorted data */
  filteredData: T[];
  /** Current search query */
  search: string;
  /** Set search query */
  setSearch: (value: string) => void;
  /** Current active filters */
  filters: Record<string, unknown>;
  /** Set a specific filter value */
  setFilter: (key: string, value: unknown) => void;
  /** Remove a specific filter */
  removeFilter: (key: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Current sort configuration */
  sort: SortConfig | null;
  /** Set sort configuration */
  setSort: (config: SortConfig) => void;
  /** Toggle sort direction for a field */
  toggleSort: (field: string) => void;
  /** Clear search and filters */
  clearAll: () => void;
  /** Whether any search or filter is active */
  isActive: boolean;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}

export function useSearchFilterSort<T>({
  data,
  searchFields,
  filterFn,
  initialSort,
  initialFilters = {},
}: UseSearchFilterSortOptions<T>): UseSearchFilterSortResult<T> {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown>>(initialFilters);
  const [sort, setSort] = useState<SortConfig | null>(initialSort ?? null);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const clearAll = useCallback(() => {
    setSearch('');
    setFilters({});
    setSort(null);
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSort(prev => {
      if (prev?.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { field, direction: 'asc' };
    });
  }, []);

  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Apply search
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(item => {
        const record = item as Record<string, unknown>;
        return searchFields.some(field => {
          const value = getNestedValue(record, field);
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(query);
        });
      });
    }

    // 2. Apply custom filters
    if (filterFn) {
      result = result.filter(item => filterFn(item, filters));
    }

    // 3. Apply sort
    if (sort) {
      result.sort((a, b) => {
        const aVal = getNestedValue(a as Record<string, unknown>, sort.field);
        const bVal = getNestedValue(b as Record<string, unknown>, sort.field);

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.direction === 'asc'
            ? aVal - bVal
            : bVal - aVal;
        }

        return 0;
      });
    }

    return result;
  }, [data, search, searchFields, filterFn, filters, sort]);

  const isActive = search.trim().length > 0 || Object.keys(filters).length > 0 || sort !== null;

  return {
    filteredData,
    search,
    setSearch,
    filters,
    setFilter,
    removeFilter,
    clearFilters,
    sort,
    setSort,
    toggleSort,
    clearAll,
    isActive,
  };
}
