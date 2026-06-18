"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type {
  Period,
  ReportSummary,
  StudentEvaluation,
  PhaseStudentEvaluation,
  ReportPhase,
  FinalGrade,
  PeerReview,
  ReportGroup,
  PaginationData,
  SortDir,
} from "../types";

const REPORTS_QUERY_KEY = ["admin", "reports"] as const;

export function useReportsPeriods() {
  return useQuery<Period[]>({
    queryKey: [...REPORTS_QUERY_KEY, "periods"],
    queryFn: async () => {
      const res = await api.get("/admin/periods");
      return res.data?.data || [];
    },
  });
}

export function useReportsSummary(periodId: string | undefined) {
  return useQuery<ReportSummary | null>({
    queryKey: [...REPORTS_QUERY_KEY, "summary", periodId],
    queryFn: async () => {
      if (!periodId) return null;
      const res = await api.get("/admin/reports/summary", {
        params: { period_id: periodId },
      });
      return res.data?.data || null;
    },
    enabled: !!periodId,
  });
}

interface AssessmentsFilters {
  studentSearch: string;
  sortBy: "group" | "name";
  page: number;
  perPage: number;
}

export function useAssessmentsReport(periodId: string | undefined) {
  const [filters, setFilters] = useState<AssessmentsFilters>({
    studentSearch: "",
    sortBy: "group",
    page: 1,
    perPage: 50,
  });
  const defaultPagination: PaginationData = {
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  };

  const queryKey = [
    ...REPORTS_QUERY_KEY,
    "assessments",
    periodId,
    filters.studentSearch,
    filters.sortBy,
    filters.page,
    filters.perPage,
  ];

  const { data: response, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!periodId) return null;
      const params: Record<string, string | number> = {
        period_id: periodId,
        page: filters.page,
        per_page: filters.perPage,
        sort_by: filters.sortBy,
      };
      if (filters.studentSearch) {
        params.student_search = filters.studentSearch;
      }
      const res = await api.get("/admin/reports/student-evaluations-summary", {
        params,
      });
      return res.data as { data: StudentEvaluation[]; meta: PaginationData };
    },
    enabled: !!periodId,
  });

  const setStudentSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, studentSearch: value, page: 1 }));
  }, []);

  const setSortBy = useCallback((value: "group" | "name") => {
    setFilters((prev) => ({ ...prev, sortBy: value, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setFilters((prev) => ({ ...prev, perPage, page: 1 }));
  }, []);

  return {
    students: response?.data ?? [],
    loading,
    pagination: response?.meta ?? defaultPagination,
    filters,
    setStudentSearch,
    setSortBy,
    setPage,
    setPerPage,
  };
}

interface PhaseEvaluationsFilters {
  studentSearch: string;
  sortBy: "group" | "name";
  page: number;
  perPage: number;
}

export function usePhaseEvaluationsReport(
  periodId: string | undefined,
  phase: ReportPhase | undefined
) {
  const [filters, setFilters] = useState<PhaseEvaluationsFilters>({
    studentSearch: "",
    sortBy: "group",
    page: 1,
    perPage: 50,
  });
  const defaultPagination: PaginationData = {
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  };

  const queryKey = [
    ...REPORTS_QUERY_KEY,
    "phase-evaluations",
    periodId,
    phase,
    filters.studentSearch,
    filters.sortBy,
    filters.page,
    filters.perPage,
  ];

  const { data: response, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!periodId || !phase) return null;
      const params: Record<string, string | number> = {
        period_id: periodId,
        phase,
        page: filters.page,
        per_page: filters.perPage,
        sort_by: filters.sortBy,
      };
      if (filters.studentSearch) {
        params.student_search = filters.studentSearch;
      }
      const res = await api.get("/admin/reports/phase-evaluations", { params });
      return res.data as { data: PhaseStudentEvaluation[]; meta: PaginationData };
    },
    enabled: !!periodId && !!phase,
  });

  const setStudentSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, studentSearch: value, page: 1 }));
  }, []);

  const setSortBy = useCallback((value: "group" | "name") => {
    setFilters((prev) => ({ ...prev, sortBy: value, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setFilters((prev) => ({ ...prev, perPage, page: 1 }));
  }, []);

  return {
    students: response?.data ?? [],
    loading,
    pagination: response?.meta ?? defaultPagination,
    filters,
    setStudentSearch,
    setSortBy,
    setPage,
    setPerPage,
  };
}

interface FinalGradesFilters {
  groupId: string;
  status: string;
  studentSearch: string;
  page: number;
  perPage: number;
  sortBy: "group" | "name";
  sortDir: SortDir;
}

export function useFinalGradesReport(periodId: string | undefined) {
  const [filters, setFilters] = useState<FinalGradesFilters>({
    groupId: "all",
    status: "all",
    studentSearch: "",
    page: 1,
    perPage: 50,
    sortBy: "group",
    sortDir: "asc",
  });
  const defaultPagination: PaginationData = {
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  };

  const queryKey = [
    ...REPORTS_QUERY_KEY,
    "final-grades",
    periodId,
    filters.groupId,
    filters.status,
    filters.studentSearch,
    filters.page,
    filters.perPage,
    filters.sortBy,
    filters.sortDir,
  ];

  const { data: response, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!periodId) return null;
      const params: Record<string, string | number> = {
        period_id: periodId,
        page: filters.page,
        per_page: filters.perPage,
        sort_by: filters.sortBy,
        sort_order: filters.sortDir,
      };
      if (filters.groupId !== "all") {
        params.group_id = filters.groupId;
      }
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.studentSearch) {
        params.student_search = filters.studentSearch;
      }
      const res = await api.get("/admin/reports/final-grades", { params });
      return res.data as { data: FinalGrade[]; meta: PaginationData };
    },
    enabled: !!periodId,
  });

  const setGroupId = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, groupId: value, page: 1 }));
  }, []);

  const setStatus = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, status: value, page: 1 }));
  }, []);

  const setStudentSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, studentSearch: value, page: 1 }));
  }, []);

  const setSort = useCallback((key: "group" | "name") => {
    setFilters((prev) => {
      if (prev.sortBy === key) {
        return { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" };
      }
      return { ...prev, sortBy: key, sortDir: "asc", page: 1 };
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setFilters((prev) => ({ ...prev, perPage, page: 1 }));
  }, []);

  return {
    grades: response?.data ?? [],
    loading,
    pagination: response?.meta ?? defaultPagination,
    filters,
    setGroupId,
    setStatus,
    setStudentSearch,
    setSort,
    setPage,
    setPerPage,
  };
}

interface PeerReviewsFilters {
  groupId: string;
  studentSearch: string;
  sortBy: "created_at" | "reviewer" | "reviewee" | "raw_score" | "score";
  sortOrder: SortDir;
  page: number;
  perPage: number;
}

export function usePeerReviewsReport(periodId: string | undefined) {
  const [filters, setFilters] = useState<PeerReviewsFilters>({
    groupId: "all",
    studentSearch: "",
    sortBy: "created_at",
    sortOrder: "desc",
    page: 1,
    perPage: 50,
  });
  const defaultPagination: PaginationData = {
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  };

  const queryKey = [
    ...REPORTS_QUERY_KEY,
    "peer-reviews",
    periodId,
    filters.groupId,
    filters.studentSearch,
    filters.sortBy,
    filters.sortOrder,
    filters.page,
    filters.perPage,
  ];

  const { data: response, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!periodId) return null;
      const params: Record<string, string | number> = {
        period_id: periodId,
        page: filters.page,
        per_page: filters.perPage,
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
      };
      if (filters.groupId !== "all") {
        params.group_id = filters.groupId;
      }
      if (filters.studentSearch) {
        params.student_search = filters.studentSearch;
      }
      const res = await api.get("/admin/reports/peer-reviews", { params });
      return res.data as { data: PeerReview[]; meta: PaginationData };
    },
    enabled: !!periodId,
  });

  const setGroupId = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, groupId: value, page: 1 }));
  }, []);

  const setStudentSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, studentSearch: value, page: 1 }));
  }, []);

  const setSort = useCallback((key: "created_at" | "reviewer" | "reviewee" | "raw_score" | "score") => {
    setFilters((prev) => {
      if (prev.sortBy === key) {
        return { ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" };
      }
      return { ...prev, sortBy: key, sortOrder: "asc", page: 1 };
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setFilters((prev) => ({ ...prev, perPage, page: 1 }));
  }, []);

  return {
    reviews: response?.data ?? [],
    loading,
    pagination: response?.meta ?? defaultPagination,
    filters,
    setGroupId,
    setStudentSearch,
    setSort,
    setPage,
    setPerPage,
  };
}

interface GroupsFilters {
  status: string;
  searchQuery: string;
  page: number;
  perPage: number;
}

export function useGroupsReport(periodId: string | undefined) {
  const [filters, setFilters] = useState<GroupsFilters>({
    status: "all",
    searchQuery: "",
    page: 1,
    perPage: 25,
  });
  const defaultPagination: PaginationData = {
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
  };

  const queryKey = [
    ...REPORTS_QUERY_KEY,
    "groups",
    periodId,
    filters.status,
    filters.searchQuery,
    filters.page,
    filters.perPage,
  ];

  const { data: response, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!periodId) return null;
      const params: Record<string, string | number> = {
        period_id: periodId,
        page: filters.page,
        per_page: filters.perPage,
      };
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.searchQuery) {
        params.search = filters.searchQuery;
      }
      const res = await api.get("/admin/reports/groups", { params });
      return res.data as { data: ReportGroup[]; meta: PaginationData };
    },
    enabled: !!periodId,
  });

  const setStatus = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, status: value, page: 1 }));
  }, []);

  const setSearchQuery = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: value, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setFilters((prev) => ({ ...prev, perPage, page: 1 }));
  }, []);

  return {
    groups: response?.data ?? [],
    loading,
    pagination: response?.meta ?? defaultPagination,
    filters,
    setStatus,
    setSearchQuery,
    setPage,
    setPerPage,
  };
}

export function useReportExport(type: string, periodId: string | undefined) {
  return useMutation({
    mutationFn: async (params?: Record<string, string | number>) => {
      if (!periodId) throw new Error("Period is required");
      const exportParams: Record<string, string | number> = {
        period_id: periodId,
        format: "csv",
        ...params,
      };
      const res = await api.get(`/admin/reports/${type}/export`, {
        params: exportParams,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_report_period_${periodId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success(`${type.replace(/-/g, " ")} report downloaded`);
    },
    onError: () => {
      toast.error("Failed to export report");
    },
  });
}
