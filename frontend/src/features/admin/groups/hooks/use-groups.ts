"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Group, PeriodOption, PaginationData } from "../types";

const QUERY_KEY = ['admin', 'groups'] as const;

interface UseGroupsReturn {
  groups: Group[];
  periods: PeriodOption[];
  loading: boolean;
  pagination: PaginationData;
  selectedPeriod: string;
  setSelectedPeriod: (value: string) => void;
  fetchData: (page?: number, perPage?: number) => Promise<void>;
  deleteGroup: (group: Group) => Promise<void>;
}

export function useGroups(): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [pagination, setPagination] = useState<PaginationData>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });

  const fetchData = useCallback(
    async (page: number = 1, perPage?: number) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          page: page.toString(),
          per_page: (perPage ?? pagination.per_page).toString(),
        };

        if (selectedPeriod !== "all") {
          params.period_id = selectedPeriod;
        }

        const [periodsRes, groupsRes] = await Promise.all([
          api.get("/periods-list"),
          api.get("/admin/groups", { params }),
        ]);

        setPeriods(periodsRes.data?.data || []);
        setGroups(groupsRes.data?.data || []);
        const pag = groupsRes.data?.pagination || {};
        setPagination({
          current_page: pag.current_page || 1,
          last_page: pag.last_page || 1,
          per_page: pag.per_page || 10,
          total: pag.total || 0,
        });
      } catch (error) {
        console.error("Failed to fetch groups data", error);
        toast.error(api.getApiErrorMessage(error, "Failed to load groups"));
      } finally {
        setLoading(false);
      }
    },
    [selectedPeriod, pagination.per_page]
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const deleteGroup = useCallback(
    async (group: Group) => {
      try {
        await api.delete(`/admin/groups/${group.id}/force-delete`);
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        toast.success("Group deleted successfully");
      } catch (error: unknown) {
        console.error("Failed to delete group", error);
        toast.error(api.getApiErrorMessage(error, "Failed to delete group"));
      }
    },
    []
  );

  return {
    groups,
    periods,
    loading,
    pagination,
    selectedPeriod,
    setSelectedPeriod,
    fetchData,
    deleteGroup,
  };
}
