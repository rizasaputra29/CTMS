"use client";

import { useState, useCallback } from "react";

export interface UseExpandableRowsReturn<TId = number> {
  expandedIds: Set<TId>;
  isExpanded: (id: TId) => boolean;
  toggleExpanded: (id: TId) => void;
  expand: (id: TId) => void;
  collapse: (id: TId) => void;
  expandAll: (ids: TId[]) => void;
  collapseAll: () => void;
}

export function useExpandableRows<TId = number>(): UseExpandableRowsReturn<TId> {
  const [expandedIds, setExpandedIds] = useState<Set<TId>>(new Set());

  const isExpanded = useCallback(
    (id: TId) => expandedIds.has(id),
    [expandedIds]
  );

  const toggleExpanded = useCallback((id: TId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((id: TId) => {
    setExpandedIds((prev) => new Set(prev).add(id));
  }, []);

  const collapse = useCallback((id: TId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: TId[]) => {
    setExpandedIds(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return {
    expandedIds,
    isExpanded,
    toggleExpanded,
    expand,
    collapse,
    expandAll,
    collapseAll,
  };
}
