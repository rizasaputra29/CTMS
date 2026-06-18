"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  DashboardResponse,
  SupervisedResponse,
  EvalCountResponse,
  DosenDashboardData,
  Period,
} from "../types";

const fetchDashboard = async (
  periodId?: string
): Promise<DashboardResponse> => {
  const params = periodId ? { period_id: periodId } : undefined;
  const response = await api.get("/dosen/dashboard", { params });
  return response.data?.data ?? response.data;
};

const fetchSupervised = async (
  periodId?: string
): Promise<SupervisedResponse> => {
  const params = periodId ? { period_id: periodId } : undefined;
  const response = await api.get("/dosen/groups/supervised", { params });
  return response.data?.data ?? response.data;
};

const fetchEvalCount = async (): Promise<EvalCountResponse> => {
  const response = await api.get("/dosen/supervisor-evaluation/pending-count");
  return response.data?.data ?? response.data;
};

interface UseDosenDashboardReturn {
  data: DosenDashboardData | null;
  isLoading: boolean;
  isDashboardLoading: boolean;
  isSupervisedLoading: boolean;
  isEvalLoading: boolean;
  selectedPeriod: string;
  handlePeriodChange: (value: string) => void;
  periods: Period[];
}

export function useDosenDashboard(): UseDosenDashboardReturn {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const periodParam = useMemo(
    () => (selectedPeriod === "all" ? undefined : selectedPeriod),
    [selectedPeriod]
  );

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["dosen", "dashboard", periodParam],
    queryFn: () => fetchDashboard(periodParam),
  });

  const { data: supervisedData, isLoading: isSupervisedLoading } = useQuery({
    queryKey: ["dosen", "supervised", periodParam],
    queryFn: () => fetchSupervised(periodParam),
  });

  const { data: evalCountData, isLoading: isEvalLoading } = useQuery({
    queryKey: ["dosen", "eval-count"],
    queryFn: fetchEvalCount,
  });

  const data = useMemo<DosenDashboardData | null>(() => {
    if (!dashboardData || !supervisedData) return null;

    const allPeriods = dashboardData?.available_periods || [];
    const supervisedArr =
      supervisedData?.data ??
      (Array.isArray(supervisedData) ? supervisedData : []);

    const recentSubmissions = supervisedArr.slice(0, 5).map((g) => ({
      id: g.id,
      label: g.code || `Group ${g.id}`,
      subtitle: `Period: ${g.period?.name || "N/A"}`,
      status: {
        label: g.status || "Active",
        variant: "outline" as const,
      },
      href: "/dosen/supervised-groups",
    }));

    return {
      supervisedGroups: dashboardData?.active_groups ?? 0,
      pendingEvaluations: evalCountData?.count ?? 0,
      pendingProposals: dashboardData?.pending_proposals ?? 0,
      availablePeriods: allPeriods.length,
      periods: allPeriods,
      recentSubmissions,
    };
  }, [dashboardData, supervisedData, evalCountData]);

  const handlePeriodChange = useCallback(
    (value: string) => {
      setSelectedPeriod(value);
      const newPeriod = value === "all" ? undefined : value;
      queryClient.invalidateQueries({
        queryKey: ["dosen", "dashboard", newPeriod],
      });
      queryClient.invalidateQueries({
        queryKey: ["dosen", "supervised", newPeriod],
      });
    },
    [queryClient]
  );

  return {
    data,
    isLoading: isDashboardLoading || isSupervisedLoading || isEvalLoading,
    isDashboardLoading,
    isSupervisedLoading,
    isEvalLoading,
    selectedPeriod,
    handlePeriodChange,
    periods: data?.periods ?? [],
  };
}
