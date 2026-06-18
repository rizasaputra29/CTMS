"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type { MahasiswaDashboardData, MiniCalendarEvent } from "../types";

const QUERY_KEY = ["mahasiswa", "dashboard"] as const;

interface UseMahasiswaDashboardReturn extends MahasiswaDashboardData {
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useMahasiswaDashboard(): UseMahasiswaDashboardReturn {
  const { data, isLoading: loading, refetch } = useQuery<MahasiswaDashboardData>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      // Check registration first
      const periodRes = await api.get("/mahasiswa/my-period");
      const periodData = periodRes.data?.data ?? periodRes.data;
      const hasRegistration = !!periodData?.period;
      if (!hasRegistration) {
        window.location.href = "/mahasiswa/registration";
        return {
          stats: null,
          group: null,
          schedules: [],
          workflow: null,
        };
      }
      if (periodData?.auto_registered) {
        toast.success(
          periodData?.message ||
            "Anda telah terdaftar otomatis berdasarkan grup yang sudah ada."
        );
      }

      // Fetch dashboard stats + group + schedules in parallel
      const [statsRes, groupRes, scheduleRes] = await Promise.allSettled([
        api.get("/mahasiswa/dashboard"),
        api.get("/mahasiswa/group").catch(() => null),
        api.get("/mahasiswa/all-schedules").catch(() => null),
      ]);

      let statsData = null;
      let workflowData = null;
      let groupData = null;
      let scheduleData: MiniCalendarEvent[] = [];

      if (statsRes.status === "fulfilled") {
        statsData = statsRes.value.data?.data ?? statsRes.value.data;
        if (statsData?.workflow?.phases && statsData.workflow.phases.length > 0) {
          workflowData = statsData.workflow;
        }
      }

      if (groupRes.status === "fulfilled" && groupRes.value) {
        const raw = groupRes.value.data?.data ?? groupRes.value.data;
        groupData = raw?.group || raw;
      }

      if (scheduleRes.status === "fulfilled" && scheduleRes.value) {
        const raw =
          scheduleRes.value.data?.data || scheduleRes.value.data || [];
        scheduleData = raw.map(
          (s: {
            id: number | string;
            date: string;
            type: string;
            student_name?: string;
            group?: { title?: { title?: string } | null };
          }) => ({
            id: s.id,
            date: s.date,
            title: s.student_name || s.group?.title?.title || s.type,
            type: s.type,
          })
        );
      }

      // Only fetch workflow separately if not provided by /mahasiswa/dashboard
      if (!statsData?.workflow?.phases) {
        try {
          const workflowRes = await api.get("/mahasiswa/workflow");
          // API returns { status, code, data: { phases, current_phase, is_graduated } }
          workflowData = workflowRes.data?.data || workflowRes.data;
        } catch {
          // workflow not available yet
        }
      }

      return {
        stats: statsData,
        group: groupData,
        schedules: scheduleData,
        workflow: workflowData,
      };
    },
  });

  const refetchDashboard = async () => {
    await refetch();
  };

  return {
    stats: data?.stats ?? null,
    group: data?.group ?? null,
    schedules: data?.schedules ?? [],
    workflow: data?.workflow ?? null,
    loading,
    refetch: refetchDashboard,
  };
}
