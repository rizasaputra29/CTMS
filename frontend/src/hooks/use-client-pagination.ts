"use client";

import { useMemo, useState } from "react";

export interface UseClientPaginationOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  pageSizes?: number[];
}

export interface ClientPaginationState {
  page: number;
  pageSize: number;
  totalPages: number;
  safePage: number;
  showingStart: number;
  showingEnd: number;
  totalItems: number;
  pageSizes: number[];
  setPage: (page: number | ((prev: number) => number)) => void;
  setPageSize: (size: number) => void;
}

export function useClientPagination<T>(
  data: T[],
  options: UseClientPaginationOptions = {}
): { paginatedData: T[]; pagination: ClientPaginationState } {
  const {
    defaultPage = 1,
    defaultPageSize = 10,
    pageSizes = [10, 25, 50],
  } = options;

  const [page, setPage] = useState(defaultPage);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  const showingStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, totalItems);

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    paginatedData,
    pagination: {
      page,
      pageSize,
      totalPages,
      safePage,
      showingStart,
      showingEnd,
      totalItems,
      setPage,
      setPageSize: handleSetPageSize,
      pageSizes,
    },
  };
}
