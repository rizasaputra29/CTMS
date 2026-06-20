"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type {
  GroupDocumentUpload,
  DocumentUpload,
  DocumentSummary,
  PeriodOption,
  PaginationData,
  DocumentFilters,
} from "../types";

const QUERY_KEY = ["admin", "document-uploads"] as const;

async function fetchPeriods(): Promise<PeriodOption[]> {
  const res = await api.get("/periods-list");
  return res.data?.data || [];
}

async function fetchGroupDocuments(
  filters: DocumentFilters,
  page: number,
  perPage: number
): Promise<{ groups: GroupDocumentUpload[]; pagination: PaginationData }> {
  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  };

  if (filters.period_id && filters.period_id !== "all") {
    params.period_id = filters.period_id;
  }
  if (filters.group_id) {
    params.group_id = filters.group_id;
  }
  if (filters.student_id) {
    params.student_id = filters.student_id;
  }
  if (filters.source && filters.source !== "all") {
    params.source = filters.source;
  }
  if (filters.status && filters.status !== "all") {
    params.status = filters.status;
  }
  if (filters.date_from) {
    params.date_from = filters.date_from;
  }
  if (filters.date_to) {
    params.date_to = filters.date_to;
  }
  if (filters.search) {
    params.search = filters.search;
  }

  const res = await api.get("/admin/document-uploads", { params });
  return {
    groups: res.data?.data?.data || [],
    pagination: res.data?.data?.pagination || {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 0,
    },
  };
}

async function fetchSummary(periodId?: string): Promise<DocumentSummary> {
  const params: Record<string, string> = {};
  if (periodId && periodId !== "all") {
    params.period_id = periodId;
  }
  const res = await api.get("/admin/document-uploads/summary", { params });
  return res.data?.data || {
    groups_with_uploads: 0,
    students_with_uploads: 0,
    phase_documents: 0,
    expo_documents: 0,
    ta_documents: 0,
    total_documents: 0,
  };
}

export function useDocumentUploads() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DocumentFilters>({
    period_id: "all",
    source: "all",
    status: "all",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const periodsQuery = useQuery<PeriodOption[]>({
    queryKey: [...QUERY_KEY, "periods"],
    queryFn: fetchPeriods,
  });

  const groupsQuery = useQuery({
    queryKey: [...QUERY_KEY, "groups", filters, page, perPage],
    queryFn: () => fetchGroupDocuments(filters, page, perPage),
  });

  const summaryQuery = useQuery<DocumentSummary>({
    queryKey: [...QUERY_KEY, "summary", filters.period_id],
    queryFn: () => fetchSummary(filters.period_id),
  });

  const groups = groupsQuery.data?.groups || [];
  const pagination = groupsQuery.data?.pagination || {
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  };
  const periods = periodsQuery.data || [];
  const summary = summaryQuery.data || null;

  const handleFiltersChange = useCallback(
    (newFilters: DocumentFilters) => {
      setFilters(newFilters);
      setPage(1);
    },
    []
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
    },
    []
  );

  const handlePerPageChange = useCallback(
    (newPerPage: number) => {
      setPerPage(newPerPage);
      setPage(1);
    },
    []
  );

  const downloadDocument = useCallback(
    async (doc: DocumentUpload) => {
      try {
        const response = await api.get(
          `/admin/document-uploads/${doc.id}/download`,
          {
            params: { source: doc.source },
            responseType: "blob",
          }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = window.document.createElement("a");
        link.href = url;
        link.setAttribute("download", doc.original_name);
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        toast.success("Document downloaded successfully");
      } catch (error) {
        console.error("Failed to download document", error);
        toast.error(
          api.getApiErrorMessage(error, "Failed to download document")
        );
      }
    },
    []
  );

  return {
    groups,
    summary,
    periods,
    loading: groupsQuery.isLoading,
    summaryLoading: summaryQuery.isLoading,
    pagination,
    filters,
    setFilters: handleFiltersChange,
    onPageChange: handlePageChange,
    onPerPageChange: handlePerPageChange,
    downloadDocument,
  };
}
